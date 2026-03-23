#for topic filtering

from typing import List, Optional


def filter_chunks_by_topic(chunks: List[str], topic: Optional[str]) -> List[str]:
    if not topic:
        return chunks

    topic = topic.lower()
    return [chunk for chunk in chunks if topic in chunk.lower()]
