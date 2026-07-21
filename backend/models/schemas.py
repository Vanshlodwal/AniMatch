from pydantic import BaseModel, Field
from typing import List, Optional


class RecommendRequest(BaseModel):
    age: int = Field(..., ge=1, le=120, description="User's age in years")
    genres: List[str] = Field(..., min_length=1, description="Selected genre(s)")
    mood: str = Field(..., description="User's current mood")


class RandomRequest(BaseModel):
    age: Optional[int] = Field(None, ge=1, le=120, description="Optional age for content filtering")


class AnimeRecommendation(BaseModel):
    title: str
    synopsis: str
    why: str
    age_rating_note: str
    genre_tags: List[str]
    model_used: str
    random: bool = False


class AnimeRecommendationLLM(BaseModel):
    title: str = Field(..., description="Anime title in English/Romaji")
    synopsis: str = Field(..., description="2-3 sentence plot summary, no spoilers")
    why: str = Field(..., description="2-3 sentences explaining why it fits, mentioning community opinion")
    age_rating_note: str = Field(..., description="Brief content suitability note")
    genre_tags: List[str] = Field(..., description="3-5 genre/theme tags")


class AnimeRecommendationsList(BaseModel):
    recommendations: List[AnimeRecommendationLLM] = Field(..., description="List of recommended anime titles")

