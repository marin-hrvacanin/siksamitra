"""
youtube_audio.py — pull audio from a YouTube (or any yt-dlp-supported) URL.

Used by the /api/align/youtube endpoint and the youtube_map.py CLI so a user can
test the unified audio→text mapping by just pasting a URL — no manual download.

Requires yt-dlp (pip install yt-dlp) and ffmpeg on PATH (already present on this
host). Audio is extracted to a compact MP3 in cache/youtube_test/; the alignment
engine re-decodes/resamples it to 16 kHz mono internally.
"""

from __future__ import annotations

import glob
import os
from typing import Dict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT_DIR = os.path.join(BASE_DIR, 'cache', 'youtube_test')


def download_audio(url: str, out_dir: str = DEFAULT_OUT_DIR,
                   codec: str = 'mp3') -> Dict:
    """Download best audio for `url`, extract to <id>.<codec>. Returns metadata
    dict {path, title, duration, id, codec}. Raises on failure."""
    if not url or not url.strip():
        raise ValueError('empty URL')
    os.makedirs(out_dir, exist_ok=True)

    try:
        import yt_dlp  # type: ignore
    except ImportError as e:
        raise ImportError('yt-dlp is not installed (pip install yt-dlp)') from e

    opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(out_dir, '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'restrictfilenames': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': codec,
            'preferredquality': '5',  # ~96-130 kbps VBR — small, plenty for ASR
        }],
    }

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    vid = info.get('id') or 'audio'
    candidates = glob.glob(os.path.join(out_dir, f'{vid}.{codec}'))
    if not candidates:
        # extractor may have produced a slightly different name
        candidates = sorted(
            glob.glob(os.path.join(out_dir, f'{vid}.*')),
            key=os.path.getmtime, reverse=True,
        )
    if not candidates:
        raise RuntimeError('yt-dlp downloaded but no audio file was produced')

    return {
        'path': candidates[0],
        'title': info.get('title') or vid,
        'duration': float(info.get('duration') or 0.0),
        'id': vid,
        'codec': codec,
    }
