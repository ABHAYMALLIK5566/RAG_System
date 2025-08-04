import asyncio
import logging
import json
import math
import re
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
import numpy as np

logger = logging.getLogger(__name__)

class SimilarityEngine:
    """Advanced similarity engine with multiple algorithms"""
    
    def __init__(self):
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
            'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
        }
    
    def preprocess_text(self, text: str) -> List[str]:
        """Preprocess text for similarity calculation"""
        # Convert to lowercase and extract words
        text = text.lower()
        words = re.findall(r'\b\w+\b', text)
        
        # Remove stop words and short words
        words = [word for word in words if word not in self.stop_words and len(word) > 2]
        
        return words
    
    def calculate_tf_idf_similarity(
        self, 
        query_text: str, 
        documents: List[Dict[str, Any]]
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Calculate TF-IDF based similarity"""
        
        if not documents:
            return []
        
        # Preprocess query
        query_words = self.preprocess_text(query_text)
        if not query_words:
            return [(doc, 0.0) for doc in documents]
        
        # Preprocess all documents
        doc_words = []
        for doc in documents:
            content = doc.get('content', '') + ' ' + doc.get('title', '')
            doc_words.append(self.preprocess_text(content))
        
        # Calculate TF-IDF
        all_words = set(query_words)
        for words in doc_words:
            all_words.update(words)
        
        # Calculate IDF
        doc_count = len(documents)
        idf = {}
        for word in all_words:
            docs_with_word = sum(1 for words in doc_words if word in words)
            idf[word] = math.log(doc_count / (1 + docs_with_word))
        
        # Calculate query vector
        query_counter = Counter(query_words)
        query_vector = {}
        for word in all_words:
            tf = query_counter.get(word, 0) / len(query_words) if query_words else 0
            query_vector[word] = tf * idf[word]
        
        # Calculate document vectors and similarities
        similarities = []
        for i, doc in enumerate(documents):
            doc_counter = Counter(doc_words[i])
            doc_vector = {}
            
            for word in all_words:
                tf = doc_counter.get(word, 0) / len(doc_words[i]) if doc_words[i] else 0
                doc_vector[word] = tf * idf[word]
            
            # Calculate cosine similarity
            similarity = self._cosine_similarity(query_vector, doc_vector)
            similarities.append((doc, similarity))
        
        return similarities
    
    def calculate_jaccard_similarity(
        self, 
        query_text: str, 
        documents: List[Dict[str, Any]]
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Calculate Jaccard similarity"""
        
        query_words = set(self.preprocess_text(query_text))
        if not query_words:
            return [(doc, 0.0) for doc in documents]
        
        similarities = []
        for doc in documents:
            content = doc.get('content', '') + ' ' + doc.get('title', '')
            doc_words = set(self.preprocess_text(content))
            
            if not doc_words:
                similarities.append((doc, 0.0))
                continue
            
            intersection = len(query_words.intersection(doc_words))
            union = len(query_words.union(doc_words))
            
            similarity = intersection / union if union > 0 else 0.0
            similarities.append((doc, similarity))
        
        return similarities
    
    def calculate_semantic_similarity(
        self, 
        query_text: str, 
        documents: List[Dict[str, Any]]
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Calculate semantic similarity using word overlap and context"""
        
        query_words = self.preprocess_text(query_text)
        if not query_words:
            return [(doc, 0.0) for doc in documents]
        
        similarities = []
        for doc in documents:
            content = doc.get('content', '')
            title = doc.get('title', '')
            
            # Calculate different similarity components
            title_similarity = self._calculate_title_similarity(query_text, title)
            content_similarity = self._calculate_content_similarity(query_words, content)
            keyword_similarity = self._calculate_keyword_similarity(query_words, content)
            
            # Weighted combination
            final_similarity = (
                title_similarity * 0.4 +
                content_similarity * 0.4 +
                keyword_similarity * 0.2
            )
            
            similarities.append((doc, final_similarity))
        
        return similarities
    
    def _calculate_title_similarity(self, query: str, title: str) -> float:
        """Calculate similarity between query and title"""
        if not title:
            return 0.0
        
        query_lower = query.lower()
        title_lower = title.lower()
        
        # Exact match bonus
        if query_lower in title_lower:
            return 1.0
        
        # Word overlap
        query_words = set(self.preprocess_text(query))
        title_words = set(self.preprocess_text(title))
        
        if not query_words or not title_words:
            return 0.0
        
        overlap = len(query_words.intersection(title_words))
        return overlap / len(query_words)
    
    def _calculate_content_similarity(self, query_words: List[str], content: str) -> float:
        """Calculate content-based similarity"""
        if not content or not query_words:
            return 0.0
        
        content_words = self.preprocess_text(content)
        if not content_words:
            return 0.0
        
        # Count word occurrences
        content_counter = Counter(content_words)
        matches = sum(content_counter.get(word, 0) for word in query_words)
        
        # Normalize by content length (with diminishing returns)
        normalized_score = matches / (len(content_words) ** 0.5)
        return min(normalized_score, 1.0)
    
    def _calculate_keyword_similarity(self, query_words: List[str], content: str) -> float:
        """Calculate keyword-based similarity"""
        if not content or not query_words:
            return 0.0
        
        content_lower = content.lower()
        
        # Check for exact phrase matches
        query_phrase = ' '.join(query_words)
        if query_phrase in content_lower:
            return 1.0
        
        # Check for individual word matches with position weighting
        matches = 0
        total_words = len(query_words)
        
        for word in query_words:
            if word in content_lower:
                # Count multiple occurrences
                count = content_lower.count(word)
                matches += min(count * 0.3, 1.0)  # Diminishing returns for multiple occurrences
        
        return matches / total_words if total_words > 0 else 0.0
    
    def _cosine_similarity(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        """Calculate cosine similarity between two vectors"""
        
        # Get all keys
        all_keys = set(vec1.keys()) | set(vec2.keys())
        
        # Calculate dot product and magnitudes
        dot_product = 0.0
        magnitude1 = 0.0
        magnitude2 = 0.0
        
        for key in all_keys:
            v1 = vec1.get(key, 0.0)
            v2 = vec2.get(key, 0.0)
            
            dot_product += v1 * v2
            magnitude1 += v1 * v1
            magnitude2 += v2 * v2
        
        magnitude1 = math.sqrt(magnitude1)
        magnitude2 = math.sqrt(magnitude2)
        
        if magnitude1 == 0.0 or magnitude2 == 0.0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def calculate_hybrid_similarity(
        self, 
        query_text: str, 
        documents: List[Dict[str, Any]],
        weights: Optional[Dict[str, float]] = None
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Calculate hybrid similarity using multiple algorithms"""
        
        if not documents:
            return []
        
        # Default weights
        if weights is None:
            weights = {
                'tfidf': 0.4,
                'jaccard': 0.2,
                'semantic': 0.4
            }
        
        # Calculate different similarities
        tfidf_sims = self.calculate_tf_idf_similarity(query_text, documents)
        jaccard_sims = self.calculate_jaccard_similarity(query_text, documents)
        semantic_sims = self.calculate_semantic_similarity(query_text, documents)
        
        # Combine similarities
        combined_similarities = []
        for i, doc in enumerate(documents):
            tfidf_score = tfidf_sims[i][1]
            jaccard_score = jaccard_sims[i][1]
            semantic_score = semantic_sims[i][1]
            
            # Weighted combination
            final_score = (
                tfidf_score * weights['tfidf'] +
                jaccard_score * weights['jaccard'] +
                semantic_score * weights['semantic']
            )
            
            combined_similarities.append((doc, final_score))
        
        return combined_similarities
    
    def rank_documents(
        self, 
        similarities: List[Tuple[Dict[str, Any], float]], 
        top_k: int = 5,
        similarity_threshold: float = 0.1
    ) -> List[Dict[str, Any]]:
        """Rank and filter documents by similarity"""
        
        # Ensure top_k is an integer to prevent slice errors
        try:
            top_k = int(top_k) if top_k is not None else 5
            if top_k <= 0:
                top_k = 5
        except (ValueError, TypeError):
            top_k = 5
        
        # Ensure similarity_threshold is a float
        try:
            similarity_threshold = float(similarity_threshold) if similarity_threshold is not None else 0.1
        except (ValueError, TypeError):
            similarity_threshold = 0.1
        
        # Filter by threshold
        filtered = [(doc, score) for doc, score in similarities if score >= similarity_threshold]
        
        # Sort by similarity score (descending)
        sorted_docs = sorted(filtered, key=lambda x: x[1], reverse=True)
        
        # Return top k with similarity scores
        results = []
        for doc, score in sorted_docs[:top_k]:
            result_doc = doc.copy()
            result_doc['similarity_score'] = score
            results.append(result_doc)
        
        return results
    
    def calculate_similarity(
        self, 
        query_text: str, 
        documents: List[Dict[str, Any]],
        algorithm: str = "semantic"
    ) -> List[Tuple[Dict[str, Any], float]]:
        """Calculate similarity using specified algorithm (default: semantic)"""
        
        if algorithm == "tfidf":
            return self.calculate_tf_idf_similarity(query_text, documents)
        elif algorithm == "jaccard":
            return self.calculate_jaccard_similarity(query_text, documents)
        elif algorithm == "hybrid":
            return self.calculate_hybrid_similarity(query_text, documents)
        else:  # default to semantic
            return self.calculate_semantic_similarity(query_text, documents)

# Global similarity engine instance
similarity_engine = SimilarityEngine() 