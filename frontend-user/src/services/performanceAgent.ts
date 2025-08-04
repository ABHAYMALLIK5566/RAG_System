import React from 'react';

interface PerformanceMetrics {
  timestamp: number;
  duration: number;
  operation: string;
  category: 'ui' | 'network' | 'computation' | 'render' | 'user_interaction';
  details?: Record<string, any>;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  fps?: number;
  latency?: number;
}

interface TimerInstance {
  id: string;
  startTime: number;
  operation: string;
  category: PerformanceMetrics['category'];
  details?: Record<string, any>;
}

class PerformanceAgent {
  private timers: Map<string, TimerInstance> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private listeners: Set<(metrics: PerformanceMetrics) => void> = new Set();
  private fpsCounter = 0;
  private lastFpsTime = 0;
  private currentFps = 0;


  constructor() {
    this.startFpsMonitoring();
    this.startMemoryMonitoring();
  }

  // Start a performance timer
  startTimer(
    operation: string,
    category: PerformanceMetrics['category'],
    details?: Record<string, any>
  ): string {
    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.timers.set(id, {
      id,
      startTime,
      operation,
      category,
      details
    });

    // Log start for debugging
    console.log(`🚀 [PerformanceAgent] Started: ${operation}`, {
      id,
      category,
      details,
      timestamp: new Date().toISOString()
    });

    return id;
  }

  // End a performance timer
  endTimer(id: string, additionalDetails?: Record<string, any>): PerformanceMetrics | null {
    // Skip auth timers
    if (id === 'skip_auth') {
      return null;
    }
    
    const timer = this.timers.get(id);
    if (!timer) {
      console.warn(`⚠️ [PerformanceAgent] Timer not found: ${id}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      duration,
      operation: timer.operation,
      category: timer.category,
      details: { ...timer.details, ...additionalDetails },
      memory: this.getMemoryUsage(),
      fps: this.currentFps,
      latency: this.getNetworkLatency()
    };

    this.metrics.push(metrics);
    this.timers.delete(id);

    // Log completion
    console.log(`✅ [PerformanceAgent] Completed: ${timer.operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      category: timer.category,
      fps: this.currentFps,
      memory: metrics.memory,
      details: metrics.details
    });

    // Notify listeners
    this.listeners.forEach(listener => listener(metrics));

    return metrics;
  }

  // Quick timing for simple operations
  async timeOperation<T>(
    operation: string,
    category: PerformanceMetrics['category'],
    fn: () => Promise<T> | T,
    details?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(operation, category, details);
    
    try {
      const result = await fn();
      this.endTimer(timerId, { success: true });
      return result;
    } catch (error) {
      this.endTimer(timerId, { success: false, error: String(error) });
      throw error;
    }
  }

  // Time React component renders
  timeRender(componentName: string, details?: Record<string, any>): string {
    return this.startTimer(`Render_${componentName}`, 'render', details);
  }

  // Time network requests
  timeNetworkRequest(url: string, method: string = 'GET'): string {
    // Don't track auth requests to avoid interference
    if (url.includes('/auth/')) {
      console.log('🚀 [PerformanceAgent] Skipping auth request tracking:', url);
      return 'skip_auth';
    }
    return this.startTimer(`Network_${method}_${url}`, 'network', { url, method });
  }

  // Time user interactions
  timeUserInteraction(interaction: string, details?: Record<string, any>): string {
    return this.startTimer(`UserInteraction_${interaction}`, 'user_interaction', details);
  }

  // Time UI operations
  timeUIOperation(operation: string, details?: Record<string, any>): string {
    return this.startTimer(`UI_${operation}`, 'ui', details);
  }

  // Time computations
  timeComputation(computation: string, details?: Record<string, any>): string {
    return this.startTimer(`Computation_${computation}`, 'computation', details);
  }

  // Get memory usage
  private getMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  // Get network latency (simplified)
  private getNetworkLatency(): number {
    // This is a simplified version - in production you'd measure actual network latency
    return Math.random() * 100 + 10; // Simulated latency between 10-110ms
  }

  // Start FPS monitoring
  private startFpsMonitoring() {
    const measureFps = () => {
      this.fpsCounter++;
      const now = performance.now();
      
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = Math.round((this.fpsCounter * 1000) / (now - this.lastFpsTime));
        this.fpsCounter = 0;
        this.lastFpsTime = now;
      }
      
      requestAnimationFrame(measureFps);
    };
    
    requestAnimationFrame(measureFps);
  }

  // Start memory monitoring
  private startMemoryMonitoring() {
    setInterval(() => {
      const memory = this.getMemoryUsage();
      if (memory.percentage > 80) {
        console.warn('⚠️ [PerformanceAgent] High memory usage detected:', memory);
      }
    }, 5000);
  }

  // Get performance summary
  getPerformanceSummary(timeRange: number = 60000): {
    totalOperations: number;
    averageResponseTime: number;
    slowestOperations: PerformanceMetrics[];
    categoryBreakdown: Record<string, number>;
    currentFps: number;
    memoryUsage: { used: number; total: number; percentage: number };
  } {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp <= timeRange);
    
    const categoryBreakdown = recentMetrics.reduce((acc, metric) => {
      acc[metric.category] = (acc[metric.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0;

    const slowestOperations = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    return {
      totalOperations: recentMetrics.length,
      averageResponseTime,
      slowestOperations,
      categoryBreakdown,
      currentFps: this.currentFps,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // Subscribe to performance metrics
  subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get all metrics
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = [];
  }

  // Export metrics as JSON
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getPerformanceSummary(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}

// Create singleton instance
export const performanceAgent = new PerformanceAgent();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics[]>([]);
  const [summary, setSummary] = React.useState(performanceAgent.getPerformanceSummary());

  React.useEffect(() => {
    const unsubscribe = performanceAgent.subscribe((newMetric) => {
      setMetrics(prev => [...prev.slice(-99), newMetric]); // Keep last 100 metrics
      setSummary(performanceAgent.getPerformanceSummary());
    });

    return unsubscribe;
  }, []);

  return {
    metrics,
    summary,
    startTimer: performanceAgent.startTimer.bind(performanceAgent),
    endTimer: performanceAgent.endTimer.bind(performanceAgent),
    timeOperation: performanceAgent.timeOperation.bind(performanceAgent),
    timeRender: performanceAgent.timeRender.bind(performanceAgent),
    timeNetworkRequest: performanceAgent.timeNetworkRequest.bind(performanceAgent),
    timeUserInteraction: performanceAgent.timeUserInteraction.bind(performanceAgent),
    timeUIOperation: performanceAgent.timeUIOperation.bind(performanceAgent),
    timeComputation: performanceAgent.timeComputation.bind(performanceAgent),
    exportMetrics: performanceAgent.exportMetrics.bind(performanceAgent),
    clearMetrics: performanceAgent.clearMetrics.bind(performanceAgent)
  };
};

export default performanceAgent; 