import speech_recognition as sr
import pyttsx3
import datetime
import webbrowser
import wikipedia
import threading
import tkinter as tk
import sys
import os
import asyncio
import pyaudio

# Initialize the text-to-speech engine
engine = pyttsx3.init()

# Thread-safe flags for controlling the assistant
stop_event = threading.Event()  # Stops the assistant loop
assistant_active = threading.Event()  # Tracks if the assistant is active

# Function to make the assistant speak
def speak(text):
    """Converts text to speech using the pyttsx3 engine."""
    engine.say(text)
    engine.runAndWait()

# Asynchronous function to listen to user input
async def listen():
    """Listens to the user's voice input and converts it to text."""
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")  # Let the user know the assistant is listening
        try:
            audio = recognizer.listen(source)
            query = recognizer.recognize_google(audio)  # Use Google's speech recognition API
            print(f"You said: {query}")  # Debugging: print what the user said
            return query.lower()  # Return the query in lowercase for easier processing
        except sr.UnknownValueError:
            print("Sorry, I didn't catch that.")  # Handle unrecognized speech
            return None
        except sr.RequestError:
            print("There was an issue with the speech recognition service.")  # Handle API errors
            return None

# Function to process user commands
def process_command(command):
    """Processes the user's command and performs the appropriate action."""
    if not command:
        return

    if "time" in command:
        # Tell the current time
        current_time = datetime.datetime.now().strftime("%H:%M:%S")
        speak(f"The current time is {current_time}")
    elif "date" in command:
        # Tell today's date
        current_date = datetime.datetime.now().strftime("%B %d, %Y")
        speak(f"Today's date is {current_date}")
    elif "open chat gpt" in command:
        # Open ChatGPT in the browser
        speak("Opening Chat GPT")
        webbrowser.open("https://chatgpt.com/")
    elif "open github" in command:
        # Open GitHub in the browser
        speak("Opening GitHub")
        webbrowser.open("https://github.com")
    elif "open google" in command:
        # Open Google in the browser
        speak("Opening Google")
        webbrowser.open("https://www.google.com")
    elif "open youtube" in command:
        if "search for" in command:
            # Search YouTube for a specific query
            query = command.replace("open youtube and search for", "").strip()
            if query:
                speak(f"Searching YouTube for {query}")
                webbrowser.open(f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}")
            else:
                speak("Please specify what you want to search on YouTube.")
        else:
            # Open YouTube homepage
            speak("Opening YouTube")
            webbrowser.open("https://www.youtube.com")
    elif "search" in command:
        # Search Wikipedia for a query
        query = command.replace("search", "").strip()
        if query:
            speak(f"Searching Wikipedia for {query}")
            try:
                result = wikipedia.summary(query, sentences=2)
                speak(result)
            except wikipedia.exceptions.DisambiguationError:
                speak(f"Found multiple results for {query}. Please be more specific.")
            except wikipedia.exceptions.HTTPTimeoutError:
                speak("There was an issue with the Wikipedia request. Please try again.")
            except wikipedia.exceptions.PageError:
                speak("I couldn't find anything on Wikipedia for that topic.")
        else:
            speak("What do you want to search on Wikipedia?")
    elif "exit" in command or "quit" in command:
        # Exit the assistant
        speak("Goodbye! Have a nice day!")
        stop_event.set()
    else:
        # Handle unknown commands
        speak("Sorry, I can't perform this task.")

# Asynchronous main loop for the assistant
async def assistant_loop():
    """Main loop for the voice assistant."""
    while not stop_event.is_set():
        command = await listen()
        if command:
            process_command(command)

# Function to stop the assistant from the GUI
def stop_assistant():
    """Stops the assistant and closes the GUI."""
    stop_event.set()
    root.destroy()

# Function to handle the close event of the GUI
def on_close():
    """Handles the window close event."""
    stop_event.set()
    root.destroy()
    os._exit(0)

# Start the assistant in a separate thread
def start_assistant():
    """Starts the assistant loop in a new thread."""
    asyncio.run(assistant_loop())

# Create a simple GUI using tkinter
root = tk.Tk()
root.title("Voice Assistant")
root.geometry("300x150")
root.configure(bg='lightblue')

# Make the window non-resizable
root.resizable(False, False)

# Bind the close event to on_close
root.protocol("WM_DELETE_WINDOW", on_close)

# Add Start and Stop buttons
start_button = tk.Button(root, text="Start Assistant", command=start_assistant, font=("Arial", 10))
start_button.place(x=230, y=10, anchor="ne")

stop_button = tk.Button(root, text="Stop Assistant", command=stop_assistant, font=("Arial", 10), fg="red")
stop_button.place(x=230, y=40, anchor="ne")

# Run the GUI event loop
root.mainloop()