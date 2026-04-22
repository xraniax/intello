"""Embedding cache for frequently-used topics.

Caches topic embeddings to avoid redundant HTTP calls. Supports both Redis
and in-memory backends with automatic TTL.
"""

import os
import logging
import json
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger("engine-embedding-cache")

CACHE_TTL_HOURS = int(os.getenv("EMBEDDING_CACHE_TTL_HOURS", "24"))
USE_REDIS_CACHE = os.getenv("USE_EMBEDDING_CACHE", "true").lower() in ("true", "1", "yes")

# In-memory fallback cache
_MEMORY_CACHE = {}
_MEMORY_CACHE_TIMESTAMP = {}


class EmbeddingCache:
    """Manage embedding cache with Redis backend and in-memory fallback."""
    
    def __init__(self, use_redis: bool = True):
        self.use_redis = use_redis
        self.redis_client = None
        
        if use_redis:
            try:
                import redis
                redis_url = os.getenv("REDIS_URL", "redis://redis:6379/1")
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                logger.info(f"✓ Redis cache initialized: {redis_url}")
            except Exception as e:
                logger.warning(f"Redis cache unavailable, falling back to in-memory: {e}")
                self.redis_client = None
                self.use_redis = False
    
    def _embed_hash(self, text: str) -> str:
        """Generate cache key hash for text."""
        return hashlib.md5(text.encode()).hexdigest()
    
    def _redis_key(self, text_hash: str) -> str:
        """Build Redis key for embedding."""
        return f"embed:{text_hash}"
    
    def get(self, text: str) -> Optional[List[float]]:
        """Retrieve cached embedding for text, or None if not cached/expired.
        
        Args:
            text: Topic or text to retrieve embedding for
            
        Returns:
            List of floats (768-dim embedding) or None if not cached
        """
        text_hash = self._embed_hash(text)
        
        if self.use_redis and self.redis_client:
            try:
                cached = self.redis_client.get(self._redis_key(text_hash))
                if cached:
                    embedding = json.loads(cached)
                    logger.debug(f"Cache HIT (redis): {text[:50]}...")
                    return embedding
            except Exception as e:
                logger.warning(f"Redis get failed: {e}")
        
        # Try memory cache
        if text_hash in _MEMORY_CACHE:
            timestamp = _MEMORY_CACHE_TIMESTAMP.get(text_hash)
            if timestamp and datetime.now() < timestamp + timedelta(hours=CACHE_TTL_HOURS):
                logger.debug(f"Cache HIT (memory): {text[:50]}...")
                return _MEMORY_CACHE[text_hash]
            else:
                # Expired
                del _MEMORY_CACHE[text_hash]
                if text_hash in _MEMORY_CACHE_TIMESTAMP:
                    del _MEMORY_CACHE_TIMESTAMP[text_hash]
        
        logger.debug(f"Cache MISS: {text[:50]}...")
        return None
    
    def set(self, text: str, embedding: List[float], ttl_hours: int = CACHE_TTL_HOURS) -> None:
        """Store embedding for text in cache.
        
        Args:
            text: Topic or text
            embedding: 768-dim embedding vector
            ttl_hours: Time-to-live in hours (default from env)
        """
        text_hash = self._embed_hash(text)
        
        if self.use_redis and self.redis_client:
            try:
                redis_key = self._redis_key(text_hash)
                self.redis_client.setex(
                    redis_key,
                    ttl_hours * 3600,
                    json.dumps(embedding)
                )
                logger.debug(f"Cache SET (redis): {text[:50]}... (TTL: {ttl_hours}h)")
                return
            except Exception as e:
                logger.warning(f"Redis set failed: {e}")
        
        # Fallback to memory cache
        _MEMORY_CACHE[text_hash] = embedding
        _MEMORY_CACHE_TIMESTAMP[text_hash] = datetime.now()
        logger.debug(f"Cache SET (memory): {text[:50]}... (TTL: {ttl_hours}h)")
        
        # Cleanup old entries if memory cache gets too large
        if len(_MEMORY_CACHE) > 1000:
            logger.info("Memory cache size > 1000; cleaning up expired entries...")
            expired_keys = [
                k for k, ts in _MEMORY_CACHE_TIMESTAMP.items()
                if datetime.now() >= ts + timedelta(hours=CACHE_TTL_HOURS)
            ]
            for k in expired_keys:
                del _MEMORY_CACHE[k]
                del _MEMORY_CACHE_TIMESTAMP[k]
            logger.info(f"Cleaned up {len(expired_keys)} expired entries")
    
    def clear(self) -> None:
        """Clear all cached embeddings (useful for testing)."""
        global _MEMORY_CACHE, _MEMORY_CACHE_TIMESTAMP
        
        if self.use_redis and self.redis_client:
            try:
                self.redis_client.delete(*self.redis_client.keys("embed:*"))
                logger.info("Redis cache cleared")
            except Exception as e:
                logger.warning(f"Failed to clear Redis cache: {e}")
        
        _MEMORY_CACHE.clear()
        _MEMORY_CACHE_TIMESTAMP.clear()
        logger.info("Memory cache cleared")
    
    def stats(self) -> dict:
        """Get cache statistics."""
        return {
            "backend": "redis" if (self.use_redis and self.redis_client) else "memory",
            "memory_size": len(_MEMORY_CACHE),
            "ttl_hours": CACHE_TTL_HOURS,
            "redis_available": self.redis_client is not None,
        }


# Global cache instance
_cache_instance = None


def get_cache() -> EmbeddingCache:
    """Get global embedding cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = EmbeddingCache(use_redis=USE_REDIS_CACHE)
        logger.info(f"Embedding cache initialized (backend: {_cache_instance.stats()['backend']})")
    return _cache_instance


if __name__ == "__main__":
    # Test cache
    logging.basicConfig(level=logging.DEBUG)
    cache = get_cache()
    
    # Test set/get
    test_text = "What is machine learning?"
    test_embedding = list(range(768))  # Dummy embedding
    
    cache.set(test_text, test_embedding)
    retrieved = cache.get(test_text)
    
    print(f"Original: {test_embedding[:5]}...")
    print(f"Retrieved: {retrieved[:5] if retrieved else 'None'}...")
    print(f"Match: {retrieved == test_embedding}")
    print(f"Stats: {cache.stats()}")
