#!/usr/bin/env python3
"""ZenMix TTS Server — Edge TTS como API REST local
Corre en segundo plano y expone voces neuronales Microsoft en puerto 8765.

Uso:
    python3 tts-server.py          # inicia servidor
    python3 tts-server.py --port 8765  # puerto personalizado
"""
import asyncio
import json
import sys
import os
import tempfile
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import edge_tts

# ── Voces disponibles ──────────────────────────────────────────────────────
VOICES = [
    {"id": "es-MX-DaliaNeural", "name": "Dalia (MX)", "gender": "female", "description": "Cálida y natural"},
    {"id": "es-MX-JorgeNeural", "name": "Jorge (MX)", "gender": "male", "description": "Profunda y serena"},
    {"id": "es-MX-CecilioNeural", "name": "Cecilio (MX)", "gender": "male", "description": "Narrativa y pausada"},
    {"id": "es-ES-ElviraNeural", "name": "Elvira (ES)", "gender": "female", "description": "Melodiosa"},
    {"id": "es-ES-AlvaroNeural", "name": "Álvaro (ES)", "gender": "male", "description": "Cálida y envolvente"},
    {"id": "es-ES-AbrilNeural", "name": "Abril (ES)", "gender": "female", "description": "Suave y serena"},
    {"id": "en-US-AriaNeural", "name": "Aria (US)", "gender": "female", "description": "Versátil"},
    {"id": "en-US-GuyNeural", "name": "Guy (US)", "gender": "male", "description": "Profunda"},
    {"id": "en-US-JennyNeural", "name": "Jenny (US)", "gender": "female", "description": "Natural"},
]

PORT = int(os.environ.get("ZENMIX_TTS_PORT", 8765))
TEMP_DIR = tempfile.mkdtemp(prefix="zenmix-tts-")

class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[TTS] {args[0]} {args[1]} {args[2]}")

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_audio(self, audio_data):
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(audio_data)))
        self.end_headers()
        self.wfile.write(audio_data)

    def _send_error(self, msg, status=500):
        self._send_json({"error": msg}, status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/voices":
            self._send_json({"voices": VOICES})

        elif path == "/health":
            self._send_json({"status": "ok", "voices": len(VOICES)})

        else:
            self._send_error("Not found", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/synthesize":
            content_len = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_len))

            text = body.get("text", "").strip()
            voice = body.get("voice", "es-MX-DaliaNeural")
            rate = body.get("rate", 1.0)
            pitch = body.get("pitch", 0)

            if not text:
                self._send_error("Text is required")
                return

            # Validar voz
            valid_ids = {v["id"] for v in VOICES}
            if voice not in valid_ids:
                self._send_error(f"Voice '{voice}' not found. Available: {', '.join(valid_ids)}")
                return

            # Ejecutar edge-tts de forma asíncrona
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                audio_data = loop.run_until_complete(self._do_synthesize(text, voice, rate, pitch))
                loop.close()
                self._send_audio(audio_data)
            except Exception as e:
                self._send_error(str(e))

        else:
            self._send_error("Not found", 404)

    async def _do_synthesize(self, text: str, voice: str, rate: float, pitch: int) -> bytes:
        """Ejecutar edge-tts y devolver bytes de audio MP3."""
        # Construir SSML con estilo hipnótico
        import re

        processed = text
        processed = re.sub(r'\.\.\.', '<break time="2.5s"/>', processed)
        processed = re.sub(r'\(pausa\)', '<break time="2s"/>', processed, flags=re.I)
        processed = re.sub(r'\(respira\)', '<mstts:audiosilence value="400"/><mstts:breath type="soft"/><mstts:audiosilence value="400"/>', processed, flags=re.I)
        processed = re.sub(r'\(énfasis\)(.*?)\(énfasis\)', r'<emphasis level="strong">\1</emphasis>', processed, flags=re.I)
        processed = re.sub(r'\(susurro\)(.*?)\(susurro\)', r'<prosody volume="x-soft" pitch="+2st">\1</prosody>', processed, flags=re.I)
        processed = re.sub(r'\n{2,}', '<break time="1.5s"/>', processed)
        processed = re.sub(r'\n', '<break time="0.5s"/>', processed)
        processed = re.sub(r'\r', '', processed)
        processed = processed.strip()

        # Construir prosodia
        rate_pct = f"{int((rate - 1) * 100)}%"
        pitch_str = f"{pitch:+d}Hz"

        ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">
    <voice name="{voice}">
        <prosody rate="{rate_pct}" pitch="{pitch_str}" volume="loud">
            {processed}
        </prosody>
    </voice>
</speak>"""

        # Generar con edge-tts
        out_file = os.path.join(TEMP_DIR, f"tts_{id(text)}.mp3")
        communicate = edge_tts.Communicate(ssml, voice, rate=f"{rate_pct}")
        await communicate.save(out_file)

        with open(out_file, "rb") as f:
            data = f.read()

        os.remove(out_file)
        return data


def main():
    server = HTTPServer(("0.0.0.0", PORT), TTSHandler)
    print(f"🎤 ZenMix TTS Server corriendo en http://localhost:{PORT}")
    print(f"   Voces disponibles: {len(VOICES)}")
    print(f"   Endpoints:")
    print(f"     GET  /voices     → lista de voces")
    print(f"     GET  /health     → health check")
    print(f"     POST /synthesize → genera audio (text, voice, rate, pitch)")
    print(f"")
    print(f"   Para probar:")
    print(f"     curl -X POST http://localhost:{PORT}/synthesize \\")
    print(f"       -H 'Content-Type: application/json' \\")
    print(f"       -d '{{\"text\":\"Hola mundo...\", \"voice\":\"es-MX-DaliaNeural\"}}' -o test.mp3")
    print(f"")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido.")
        server.server_close()


if __name__ == "__main__":
    main()
