from flask import Flask, request, jsonify
from flask_cors import CORS
import speech_recognition as sr 
import pyttsx3
import datetime
import webbrowser
import wikipedia
import threading
import asyncio
import os
import base64
import tempfile
import wave

app = Flask(__name__)
CORS(app)  # This allows your React app to make requests to this API

engine = pyttsx3.init()
recognizer = sr.Recognizer()

def speak_text(text):
    """Converts text to speech using the pyttsx3 engine."""
    engine.say(text)
    engine.runAndWait()
    return True

def process_command(command):
    """Processes the user's command and returns the appropriate response."""
    if not command:
        return "I didn't hear anything"
    
    response = ""
    
    if "time" in command:
        current_time = datetime.datetime.now().strftime("%H:%M:%S")
        response = f"The current time is {current_time}"

    elif "date" in command:
        current_date = datetime.datetime.now().strftime("%B %d, %Y")
        response = f"The current date is {current_date}"

    elif "open github" in command:
        response = "Opening GitHub"
        webbrowser.open("https://github.com/princedeora18")
    
    elif "open chatgpt" in command:
        response = "Opening Chat GPT"
        webbrowser.open("https://chatgpt.com")

    elif "open youtube" in command:
        if "search for" in command:
            query = command.replace("open youtube and search for", "").strip()
            if query:
                response = f"Searching Youtube for {query}"
                webbrowser.open(f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}")
            else:
                response = "Please specify what you want to search on Youtube."
        else:
            response = "Opening YouTube"
            webbrowser.open("https://www.youtube.com")

    elif "open google" in command:
        response = "Opening Google"
        webbrowser.open("https://www.google.com")
    
    elif "exit" in command or "quit" in command:
        response = "Goodbye! Have a nice day!"
    
    else:
        response = "I understand you said: " + command + ". However, I'm not programmed to handle this request yet."
    
    return response

def transcribe_audio(audio_data):
    """Transcribe audio data to text using speech recognition."""
    try:
        # Create a temporary WAV file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_filename = temp_audio.name
            
            with wave.open(temp_filename, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit audio
                wf.setframerate(16000)  # Assuming 16kHz sample rate
                wf.writeframes(audio_data)
        
        # Use the file for recognition
        with sr.AudioFile(temp_filename) as source:
            audio = recognizer.record(source)
            text = recognizer.recognize_google(audio)
            return text.lower()
            
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return None
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@app.route('/api/process-text', methods=['POST'])
def process_text_command():
    """API endpoint to process text commands."""
    data = request.get_json()
    command = data.get('command', '')
    
    response = process_command(command)
    # Optional: You can also use text-to-speech here if needed
    # speak_text(response)
    
    return jsonify({
        'success': True,
        'response': response
    })

@app.route('/api/process-audio', methods=['POST'])
def process_audio_command():
    """API endpoint to process audio commands."""
    try:
        data = request.get_json()
        audio_base64 = data.get('audio', '')
        
        # Decode base64 audio data
        audio_data = base64.b64decode(audio_base64)
        
        # Transcribe the audio
        command = transcribe_audio(audio_data)
        
        if command:
            response = process_command(command)
            return jsonify({
                'success': True,
                'command': command,
                'response': response
            })
        else:
            return jsonify({
                'success': False,
                'error': "Could not transcribe audio"
            })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)