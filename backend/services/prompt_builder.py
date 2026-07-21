"""
Prompt builder for AniMatch.

Constructs the system prompt and user prompt that are reused across
every model in the fallback chain, ensuring consistent behaviour.
"""

from typing import List, Optional


def get_age_band(age: int) -> str:
    """Map a numeric age to a content-rating band."""
    if age < 13:
        return "Kids (G-rated: no violence, no romance, age-appropriate only)"
    elif age < 16:
        return "Teen (PG-13: mild action/adventure, light romance allowed)"
    elif age < 18:
        return "Young Adult (16+: moderate themes, no explicit content)"
    else:
        return "Adult (18+: all genres permitted, including mature themes)"


GENRE_RECOMMENDATION_GUIDE = {
    "Action": ["Fullmetal Alchemist: Brotherhood", "Attack on Titan", "Jujutsu Kaisen", "Chainsaw Man", "Yu Yu Hakusho"],
    "Romance": ["Kaguya-sama: Love is War", "Your Lie in April", "Toradora!", "Lovely Complex", "Tsurezure Children"],
    "Comedy": ["Gintama", "The Disastrous Life of Saiki K.", "Konosuba", "Nichijou", "Monthly Girls' Nozaki-kun"],
    "Isekai": ["Re:Zero − Starting Life in Another World", "Mushoku Tensei", "That Time I Got Reincarnated as a Slime", "Overlord"],
    "Horror": ["Parasyte -the maxim-", "Monster", "Another", "Shiki"],
    "Slice of Life": ["March Comes in Like a Lion", "Laid-Back Camp", "Barakamon", "K-On!"],
    "Sports": ["Haikyu!!", "Hajime no Ippo", "Blue Lock", "Slam Dunk"],
    "Sci-Fi": ["Steins;Gate", "Cyberpunk: Edgerunners", "Cowboy Bebop", "Ghost in the Shell"],
    "Fantasy": ["Frieren: Beyond Journey's End", "Made in Abyss", "Hunter x Hunter", "Fairy Tail"],
    "Psychological": ["Death Note", "Neon Genesis Evangelion", "Erased", "Monster"],
    "Seinen": ["Vinland Saga", "Berserk", "Monster", "Kingdom", "Psycho-Pass"],
    "Josei": ["Nana", "Chihayafuru", "Showa Genroku Rakugo Shinju", "Honey and Clover"],
    "Shonen": ["Hunter x Hunter", "Demon Slayer", "Naruto Shippuden", "Bleach: Thousand-Year Blood War"],
    "Shojo": ["Fruits Basket (2019)", "Ouran High School Host Club", "Kimi ni Todoke", "Maid Sama!"],
    "Thriller": ["Summertime Rendering", "The Promised Neverland", "Steins;Gate", "Monster"],
    "Historical": ["Kingdom", "Golden Kamuy", "Vinland Saga", "Dororo"],
    "Drama": ["Clannad: After Story", "Violet Evergarden", "March Comes in Like a Lion", "A Silent Voice"],
    "Adventure": ["One Piece", "Hunter x Hunter", "Frieren: Beyond Journey's End", "A Place Further Than the Universe"],
    "Music": ["Bocchi the Rock!", "Beck: Mongolian Chop Squad", "Your Lie in April", "K-On!", "Carole & Tuesday"]
}

SYSTEM_PROMPT = """\
You are AniMatch, an expert anime curator with encyclopedic knowledge of the medium.
Your job is to recommend anime to a user based on their age, preferred genres, and current mood.

Rules:
1. ALWAYS respect the stated age band. NEVER recommend titles with explicit violence,
   sexual content, or disturbing themes to users below the permitted rating tier.
2. Ensure HIGH DIVERSITY in recommendations. Deliver a mix of top-rated fan-favorites, acclaimed masterpieces, and highly-rated gems.
3. Return EXACTLY {count} distinct anime recommendations. The returned JSON array MUST contain exactly {count} objects.
4. Each recommendation must be a JSON object with these exact keys:
   - "title": (string) The anime title in English (romaji also allowed if well-known)
   - "synopsis": (string) A 2–3 sentence plot summary — no spoilers
   - "why": (string) 2–3 sentences explaining why this title fits the user's age/genre/mood, explicitly mentioning the community consensus or popular reception.
   - "age_rating_note": (string) A brief note on content rating suitability
   - "genre_tags": (array of strings) 3–5 descriptive genre/theme tags
5. Respond with ONLY the JSON array. No markdown code fences, no extra commentary.
6. If you cannot find a suitable title that respects age safety, return fewer recommendations rather than violating the rule.
"""

USER_PROMPT_TEMPLATE = """\
User profile:
- Age: {age} ({age_band})
- Preferred genres: {genres}
- Current mood: {mood}

Top genre benchmarks to consider (draw from these acclaimed titles and similar top-tier masterpieces, provided they strictly respect the age band "{age_band}"):
{genre_hints}

Please recommend EXACTLY {count} distinct anime titles that perfectly fit this user profile.
Ensure high diversity and highlight the community/fan reception for each recommendation.
Strictly respect the age band "{age_band}".
"""

RANDOM_SYSTEM_PROMPT = """\
You are AniMatch, an expert anime curator. Your job is to suggest one surprising,
delightful anime pick that the user may not have thought of.

Rules:
1. Respect the stated age band if provided. Default to "All Ages" if no age is given.
2. Focus on high diversity and unexpected choices — think hidden gems, unique visual styles, or under-appreciated cult hits.
3. Return EXACTLY 1 recommendation as a JSON array with a single object.
4. Each object must have these exact keys:
   - "title": (string)
   - "synopsis": (string) 2–3 sentence plot summary, no spoilers
   - "why": (string) Why this is a great surprise pick, including the popular fan opinion or community consensus about the show.
   - "age_rating_note": (string)
   - "genre_tags": (array of strings)
5. Respond with ONLY the JSON array. No extra commentary.
"""

RANDOM_USER_PROMPT_TEMPLATE = """\
Surprise me with one anime recommendation!
{age_context}
Make it something unexpected, highly rated by fans, but not overly mainstream.
"""


def build_recommend_prompt(
    age: int, genres: List[str], mood: str, count: int = 3
) -> tuple[str, str]:
    """
    Returns (system_prompt, user_prompt) for the structured recommendation endpoint.
    """
    age_band = get_age_band(age)
    genres_str = ", ".join(genres) if genres else "Any"

    genre_hints_list = []
    for g in genres:
        if g in GENRE_RECOMMENDATION_GUIDE:
            genre_hints_list.append(f"- {g}: {', '.join(GENRE_RECOMMENDATION_GUIDE[g])}")
    
    genre_hints_text = "\n".join(genre_hints_list) if genre_hints_list else "- Draw from top-rated classics and acclaimed gems."

    system = SYSTEM_PROMPT.format(count=count)
    user = USER_PROMPT_TEMPLATE.format(
        age=age,
        age_band=age_band,
        genres=genres_str,
        mood=mood,
        count=count,
        genre_hints=genre_hints_text,
    )
    return system, user


def build_random_prompt(age: Optional[int] = None) -> tuple[str, str]:
    """
    Returns (system_prompt, user_prompt) for the random recommendation endpoint.
    """
    if age is not None:
        age_band = get_age_band(age)
        age_context = f"My age is {age} ({age_band}). Please respect this rating."
    else:
        age_context = "No age restriction — any audience is fine."

    user = RANDOM_USER_PROMPT_TEMPLATE.format(age_context=age_context)
    return RANDOM_SYSTEM_PROMPT, user

