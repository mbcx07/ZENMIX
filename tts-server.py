import asyncio
import json
import os
import re
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import edge_tts

PORT = int(os.environ.get("PORT", 8765))
TEMP_DIR = tempfile.mkdtemp(prefix="zenmix-tts-")

VOICES = [
    {"id": "es-MX-DaliaNeural", "name": "Dalia (MX)", "gender": "female", "description": "Voz femenina mexicana, cálida y calmada"},
    {"id": "es-MX-JorgeNeural", "name": "Jorge (MX)", "gender": "male", "description": "Voz masculina mexicana, profunda y serena"},
    {"id": "es-ES-ElviraNeural", "name": "Elvira (ES)", "gender": "female", "description": "Voz española femenina, melodiosa"},
    {"id": "en-US-JennyNeural", "name": "Jenny (US)", "gender": "female", "description": "Voz americana, muy natural"},
    {"id": "en-US-GuyNeural", "name": "Guy (US)", "gender": "male", "description": "Voz masculina americana, profunda"},
]

class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

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
        if self.path == "/voices":
            self._send_json({"voices": VOICES})
        elif self.path == "/health":
            self._send_json({"status": "ok", "voices": len(VOICES)})
        else:
            self._send_error("Not found", 404)

    def do_POST(self):
        if self.path == "/generate":
            content_len = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_len))

            text = body.get("text", "").strip()
            voice = body.get("voice_id", "es-MX-DaliaNeural")
            rate = body.get("speed", 1.0)
            pitch = body.get("pitch", 0)

            if not text:
                self._send_error("Text is required")
                return

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
        processed = text
        processed = re.sub(r'\.\.\.', '<break time="2s"/>', processed)
        processed = re.sub(r'\(pausa\)', '<break time="3s"/>', processed, flags=re.I)
        processed = re.sub(r'\(respira\)', '<mstts:audiosilence value="500"/><mstts:breath type="soft"/>', processed, flags=re.I)
        processed = re.sub(r'\n{2,}', '<break time="1s"/>', processed)
        processed = re.sub(r'\n', '<break time="0.3s"/>', processed)
        processed = processed.strip()

        rate_pct = f"{int((rate - 1) * 100)}%"
        pitch_str = f"{pitch:+d}Hz"

        ssml = f'''<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">
    <voice name="{voice}">
        <prosody rate="{rate_pct}" pitch="{pitch_str}" volume="loud">
            {processed}
        </prosody>
    </voice>
</speak>'''

        out_file = os.path.join(TEMP_DIR, f"tts_{id(text)}.mp3")
        communicate = edge_tts.Communicate(ssml, voice, rate=rate_pct)
        await communicate.save(out_file)

        with open(out_file, "rb") as f:
            data = f.read()

        try:
            os.remove(out_file)
        except:
            pass

        return data

def main():
    server = HTTPServer(("0.0.0.0", PORT), TTSHandler)
    print(f"🎤 ZenMix TTS Server running on port {PORT}")
    server.serve_forever()

if __name__ == "__main__":
    main()
