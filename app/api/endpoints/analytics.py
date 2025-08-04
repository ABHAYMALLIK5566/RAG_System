"""
User Analytics API Endpoints

This module provides analytics endpoints for user-specific data including:
- Query statistics and trends
- Response time analysis
- Usage patterns
- Performance metrics
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, and_, desc
from sqlalchemy.sql import text

from ...security.auth import get_current_user, require_permission
from ...security.models import User, Permission
from ...core.database import db_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Request/Response Models
class AnalyticsTimeRange(BaseModel):
    start_date: str = Field(..., description="Start date in ISO format")
    end_date: str = Field(..., description="End date in ISO format")

class QueryStatistics(BaseModel):
    total_queries: int
    successful_queries: int
    failed_queries: int
    success_rate: float
    avg_response_time: float
    total_response_time: float
    unique_sessions: int

class UsageTrend(BaseModel):
    date: str
    queries: int
    avg_response_time: float
    success_rate: float

class QueryTypeDistribution(BaseModel):
    query_type: str
    count: int
    percentage: float
    avg_response_time: float

class PerformanceMetrics(BaseModel):
    response_time_buckets: Dict[str, int]
    hourly_usage: List[Dict[str, Any]]
    daily_usage: List[Dict[str, Any]]
    weekly_usage: List[Dict[str, Any]]

class UserAnalyticsResponse(BaseModel):
    user_id: str
    username: str
    time_range: AnalyticsTimeRange
    statistics: QueryStatistics
    trends: List[UsageTrend]
    query_types: List[QueryTypeDistribution]
    performance: PerformanceMetrics
    recent_activity: List[Dict[str, Any]]

@router.get("/user/overview")
async def get_user_analytics_overview(
    time_range: str = Query(default="7d", description="Time range: 24h, 7d, 30d, 90d"),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive user analytics overview"""
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        if time_range == "24h":
            start_date = end_date - timedelta(days=1)
        elif time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)

        # Get conversation history for the user
        query = """
            SELECT 
                user_query,
                assistant_response,
                response_time_ms,
                created_at,
                rag_context,
                agent_tools_used
            FROM conversation_history 
            WHERE user_id = $1 
            AND created_at >= $2 
            AND created_at <= $3
            ORDER BY created_at DESC
        """
        
        conversations = await db_manager.execute_query(
            query, 
            current_user.id, 
            start_date, 
            end_date
        )

        if not conversations:
            # Return empty analytics
            return UserAnalyticsResponse(
                user_id=current_user.id,
                username=current_user.username,
                time_range=AnalyticsTimeRange(
                    start_date=start_date.isoformat(),
                    end_date=end_date.isoformat()
                ),
                statistics=QueryStatistics(
                    total_queries=0,
                    successful_queries=0,
                    failed_queries=0,
                    success_rate=0.0,
                    avg_response_time=0.0,
                    total_response_time=0.0,
                    unique_sessions=0
                ),
                trends=[],
                query_types=[],
                performance=PerformanceMetrics(
                    response_time_buckets={},
                    hourly_usage=[],
                    daily_usage=[],
                    weekly_usage=[]
                ),
                recent_activity=[]
            )

        # Calculate statistics
        total_queries = len(conversations)
        successful_queries = sum(1 for conv in conversations if conv.get('assistant_response'))
        failed_queries = total_queries - successful_queries
        success_rate = (successful_queries / total_queries * 100) if total_queries > 0 else 0
        
        response_times = [conv.get('response_time_ms', 0) for conv in conversations if conv.get('response_time_ms')]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        total_response_time = sum(response_times)

        # Get unique sessions
        session_query = """
            SELECT COUNT(DISTINCT session_id) as unique_sessions
            FROM conversation_history 
            WHERE user_id = $1 
            AND created_at >= $2 
            AND created_at <= $3
        """
        session_result = await db_manager.execute_one(
            session_query, 
            current_user.id, 
            start_date, 
            end_date
        )
        unique_sessions = session_result.get('unique_sessions', 0) if session_result else 0

        # Calculate daily trends
        daily_stats = {}
        for conv in conversations:
            date_str = conv['created_at'].strftime('%Y-%m-%d')
            if date_str not in daily_stats:
                daily_stats[date_str] = {
                    'queries': 0,
                    'response_times': [],
                    'successful': 0
                }
            daily_stats[date_str]['queries'] += 1
            if conv.get('response_time_ms'):
                daily_stats[date_str]['response_times'].append(conv['response_time_ms'])
            if conv.get('assistant_response'):
                daily_stats[date_str]['successful'] += 1

        trends = []
        for date_str, stats in daily_stats.items():
            avg_rt = sum(stats['response_times']) / len(stats['response_times']) if stats['response_times'] else 0
            success_rate_daily = (stats['successful'] / stats['queries'] * 100) if stats['queries'] > 0 else 0
            trends.append(UsageTrend(
                date=date_str,
                queries=stats['queries'],
                avg_response_time=avg_rt / 1000,  # Convert to seconds
                success_rate=success_rate_daily
            ))

        # Analyze query types (simple classification based on keywords)
        query_types = {}
        for conv in conversations:
            query_text = conv.get('user_query', '').lower()
            query_type = 'general'
            
            if any(word in query_text for word in ['code', 'program', 'function', 'class', 'method']):
                query_type = 'code_analysis'
            elif any(word in query_text for word in ['document', 'file', 'pdf', 'text']):
                query_type = 'document_search'
            elif any(word in query_text for word in ['data', 'analysis', 'chart', 'graph', 'statistics']):
                query_type = 'data_analysis'
            elif any(word in query_text for word in ['compare', 'difference', 'similar']):
                query_type = 'comparison'
            
            if query_type not in query_types:
                query_types[query_type] = {
                    'count': 0,
                    'response_times': []
                }
            query_types[query_type]['count'] += 1
            if conv.get('response_time_ms'):
                query_types[query_type]['response_times'].append(conv['response_time_ms'])

        query_type_distributions = []
        for query_type, stats in query_types.items():
            percentage = (stats['count'] / total_queries * 100) if total_queries > 0 else 0
            avg_rt = sum(stats['response_times']) / len(stats['response_times']) if stats['response_times'] else 0
            query_type_distributions.append(QueryTypeDistribution(
                query_type=query_type,
                count=stats['count'],
                percentage=percentage,
                avg_response_time=avg_rt / 1000  # Convert to seconds
            ))

        # Performance metrics
        response_time_buckets = {
            '0-1s': 0,
            '1-3s': 0,
            '3-5s': 0,
            '5-10s': 0,
            '10s+': 0
        }
        
        for rt in response_times:
            rt_seconds = rt / 1000
            if rt_seconds < 1:
                response_time_buckets['0-1s'] += 1
            elif rt_seconds < 3:
                response_time_buckets['1-3s'] += 1
            elif rt_seconds < 5:
                response_time_buckets['3-5s'] += 1
            elif rt_seconds < 10:
                response_time_buckets['5-10s'] += 1
            else:
                response_time_buckets['10s+'] += 1

        # Recent activity (last 10 conversations)
        recent_activity = []
        for conv in conversations[:10]:
            recent_activity.append({
                'query': conv.get('user_query', '')[:100] + '...' if len(conv.get('user_query', '')) > 100 else conv.get('user_query', ''),
                'response_time': conv.get('response_time_ms', 0) / 1000,
                'timestamp': conv['created_at'].isoformat(),
                'success': bool(conv.get('assistant_response')),
                'has_context': bool(conv.get('rag_context'))
            })

        return UserAnalyticsResponse(
            user_id=current_user.id,
            username=current_user.username,
            time_range=AnalyticsTimeRange(
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            ),
            statistics=QueryStatistics(
                total_queries=total_queries,
                successful_queries=successful_queries,
                failed_queries=failed_queries,
                success_rate=success_rate,
                avg_response_time=avg_response_time / 1000,  # Convert to seconds
                total_response_time=total_response_time / 1000,  # Convert to seconds
                unique_sessions=unique_sessions
            ),
            trends=trends,
            query_types=query_type_distributions,
            performance=PerformanceMetrics(
                response_time_buckets=response_time_buckets,
                hourly_usage=[],  # TODO: Implement hourly usage
                daily_usage=[trend.dict() for trend in trends],  # Convert to dictionaries
                weekly_usage=[]  # TODO: Implement weekly usage
            ),
            recent_activity=recent_activity
        )

    except Exception as e:
        logger.error(f"Error getting user analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

@router.get("/user/performance")
async def get_user_performance_metrics(
    time_range: str = Query(default="7d", description="Time range: 24h, 7d, 30d, 90d"),
    current_user: User = Depends(get_current_user)
):
    """Get detailed performance metrics for the user"""
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        if time_range == "24h":
            start_date = end_date - timedelta(days=1)
        elif time_range == "7d":
            start_date = end_date - timedelta(days=7)
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)

        # Get performance data
        query = """
            SELECT 
                response_time_ms,
                created_at,
                CASE 
                    WHEN response_time_ms < 1000 THEN '0-1s'
                    WHEN response_time_ms < 3000 THEN '1-3s'
                    WHEN response_time_ms < 5000 THEN '3-5s'
                    WHEN response_time_ms < 10000 THEN '5-10s'
                    ELSE '10s+'
                END as time_bucket
            FROM conversation_history 
            WHERE user_id = $1 
            AND created_at >= $2 
            AND created_at <= $3
            AND response_time_ms IS NOT NULL
        """
        
        performance_data = await db_manager.execute_query(
            query, 
            current_user.id, 
            start_date, 
            end_date
        )

        # Calculate performance metrics
        response_times = [row['response_time_ms'] for row in performance_data]
        
        if not response_times:
            return {
                "avg_response_time": 0,
                "median_response_time": 0,
                "p95_response_time": 0,
                "p99_response_time": 0,
                "min_response_time": 0,
                "max_response_time": 0,
                "response_time_distribution": {},
                "hourly_performance": []
            }

        response_times.sort()
        avg_response_time = sum(response_times) / len(response_times)
        median_response_time = response_times[len(response_times) // 2]
        p95_response_time = response_times[int(len(response_times) * 0.95)]
        p99_response_time = response_times[int(len(response_times) * 0.99)]
        min_response_time = min(response_times)
        max_response_time = max(response_times)

        # Response time distribution
        distribution = {}
        for row in performance_data:
            bucket = row['time_bucket']
            distribution[bucket] = distribution.get(bucket, 0) + 1

        return {
            "avg_response_time": avg_response_time / 1000,  # Convert to seconds
            "median_response_time": median_response_time / 1000,
            "p95_response_time": p95_response_time / 1000,
            "p99_response_time": p99_response_time / 1000,
            "min_response_time": min_response_time / 1000,
            "max_response_time": max_response_time / 1000,
            "response_time_distribution": distribution,
            "hourly_performance": []  # TODO: Implement hourly performance breakdown
        }

    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance metrics")

@router.get("/user/trends")
async def get_user_usage_trends(
    time_range: str = Query(default="7d", description="Time range: 24h, 7d, 30d, 90d"),
    current_user: User = Depends(get_current_user)
):
    """Get usage trends over time"""
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        if time_range == "24h":
            start_date = end_date - timedelta(days=1)
            interval = "hour"
        elif time_range == "7d":
            start_date = end_date - timedelta(days=7)
            interval = "day"
        elif time_range == "30d":
            start_date = end_date - timedelta(days=30)
            interval = "day"
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
            interval = "week"
        else:
            start_date = end_date - timedelta(days=7)
            interval = "day"

        # Get trend data
        if interval == "hour":
            query = """
                SELECT 
                    DATE_TRUNC('hour', created_at) as time_bucket,
                    COUNT(*) as query_count,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN assistant_response IS NOT NULL THEN 1 END) as successful_queries
                FROM conversation_history 
                WHERE user_id = $1 
                AND created_at >= $2 
                AND created_at <= $3
                GROUP BY DATE_TRUNC('hour', created_at)
                ORDER BY time_bucket
            """
        elif interval == "day":
            query = """
                SELECT 
                    DATE_TRUNC('day', created_at) as time_bucket,
                    COUNT(*) as query_count,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN assistant_response IS NOT NULL THEN 1 END) as successful_queries
                FROM conversation_history 
                WHERE user_id = $1 
                AND created_at >= $2 
                AND created_at <= $3
                GROUP BY DATE_TRUNC('day', created_at)
                ORDER BY time_bucket
            """
        else:  # week
            query = """
                SELECT 
                    DATE_TRUNC('week', created_at) as time_bucket,
                    COUNT(*) as query_count,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN assistant_response IS NOT NULL THEN 1 END) as successful_queries
                FROM conversation_history 
                WHERE user_id = $1 
                AND created_at >= $2 
                AND created_at <= $3
                GROUP BY DATE_TRUNC('week', created_at)
                ORDER BY time_bucket
            """

        trend_data = await db_manager.execute_query(
            query, 
            current_user.id, 
            start_date, 
            end_date
        )

        trends = []
        for row in trend_data:
            success_rate = (row['successful_queries'] / row['query_count'] * 100) if row['query_count'] > 0 else 0
            trends.append({
                "time_bucket": row['time_bucket'].isoformat(),
                "query_count": row['query_count'],
                "avg_response_time": (row['avg_response_time'] or 0) / 1000,  # Convert to seconds
                "success_rate": success_rate,
                "successful_queries": row['successful_queries']
            })

        return {
            "interval": interval,
            "time_range": time_range,
            "trends": trends
        }

    except Exception as e:
        logger.error(f"Error getting usage trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage trends")

@router.post("/test/create-sample-data")
async def create_sample_analytics_data(
    current_user: User = Depends(get_current_user)
):
    """Create sample analytics data for testing"""
    try:
        from datetime import datetime, timedelta
        import random
        
        # Create sample conversation history data
        sample_queries = [
            "What is machine learning?",
            "Explain neural networks",
            "How does RAG work?",
            "What are the benefits of vector databases?",
            "Explain transformer architecture",
            "How to implement document search?",
            "What is semantic search?",
            "Explain embedding models",
            "How to optimize query performance?",
            "What are the different types of AI agents?"
        ]
        
        # Insert sample data for the last 7 days
        for i in range(7):
            date = datetime.utcnow() - timedelta(days=i)
            num_queries = random.randint(3, 8)
            
            for j in range(num_queries):
                query = random.choice(sample_queries)
                response_time = random.randint(500, 3000)  # 0.5 to 3 seconds
                
                await db_manager.execute_command("""
                    INSERT INTO conversation_history 
                    (session_id, user_id, user_query, assistant_response, response_time_ms, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, 
                f"test-session-{i}", 
                current_user.id, 
                query,
                f"This is a sample response to: {query}",
                response_time,
                date
                )
        
        return {"message": "Sample analytics data created successfully", "queries_added": 7 * num_queries}
        
    except Exception as e:
        logger.error(f"Error creating sample data: {e}")
        raise HTTPException(status_code=500, detail="Failed to create sample data") 