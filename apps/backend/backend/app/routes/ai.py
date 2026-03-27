from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
import time
import httpx
import os
import google.generativeai as genai
import json
import asyncio

router = APIRouter()

# Initialize Gemini Model Global Instance
gemini_api_key = os.getenv("GEMINI_API_KEY", "")
gemini_model = None

if gemini_api_key:
    try:
        genai.configure(api_key=gemini_api_key)
        gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        print(f"Gemini model initialized successfully (key present: {bool(gemini_api_key)}).")
    except Exception as e:
        print(f"Failed to initialize Gemini: {e}")

class AnalyzeRequest(BaseModel):
    code: str
    mode: str
    model: str
    context: Optional[str] = "Deexen IDE"
    language: Optional[str] = "javascript"
    skillLevel: Optional[str] = "intermediate"
    role: Optional[str] = "user"

class AnalyzeResponse(BaseModel):
    response:  str
    mode: str
    model: str
    tokens: Optional[int] = 0
    processingTime: Optional[float] = 0.0

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_code(request: AnalyzeRequest):
    global gemini_model
    start_time = time.time()
    
    # Configuration
    api_base = os.getenv("AI_MODEL_API_BASE", "https://openrouter.ai/api/v1")
    api_key = os.getenv("OPENROUTER_API_KEY", os.getenv("AI_MODEL_API_KEY", ""))
    model_name = request.model
    mode = request.mode
    
    # Optional override for local models
    if model_name.lower() == "magicoder" and not api_key:
        api_base = "http://127.0.0.1:11434/v1"

    # Construct prompt based on mode
    skill_level = request.skillLevel.lower() if request.skillLevel else "intermediate"
    user_role = request.role.lower() if request.role else "user"
    
    # Establish Persona Base
    persona = "You are an expert coding assistant."
    if user_role == "student" or skill_level == "beginner":
        persona = (
            "You are an Advanced Debugging Assistant designed specifically for students and beginners. "
            "Your role is to help users understand and fix errors, not just provide answers. "
            "Explain errors in simple, beginner-friendly language. Use real-world analogies. "
            "Provide step-by-step fixes, explain why it happens, and do not interrupt unnecessarily."
        )
    elif user_role == "professional" or skill_level == "advanced":
        persona = (
            "You are an Advanced Coding Assistant for professionals. "
            "Provide concise answers. Focus on architecture, speed, and optimization. "
            "Provide code snippets only without long explanations unless explicitly requested."
        )

    # Establish Mode Goal
    mode_instructions = ""
    user_prompt = f"Analyze the following code:\n\n{request.code}"
    
    if mode == "debug":
        mode_instructions = "Analyze the code to find bugs, logical errors, and best practice violations. List issues and fixes."
        user_prompt = f"Debug the following code:\n\n{request.code}"
    elif mode == "enhance":
        mode_instructions = "Suggest improvements for readability, performance, structure, and caching."
        user_prompt = f"Enhance this code:\n\n{request.code}"
    elif mode == "expand":
        mode_instructions = "Suggest feature expansions, scalability improvements, and new system modules."
        user_prompt = f"Propose feature expansions for this code:\n\n{request.code}"
    elif mode == "teaching":
        mode_instructions = "Act as a socratic teacher. DO NOT provide the immediate solution. Guide the user with hints."
        user_prompt = f"Teach me about the issues in this code using hints:\n\n{request.code}"
    elif mode == "livefix":
        mode_instructions = "Act as a real-time smart monitor. Provide only critical, brief, instant fixes."
        user_prompt = f"Quickly fix any critical issues in this snippet:\n\n{request.code}"
        
    system_prompt = f"{persona}\n\nTask Instructions:\n{mode_instructions}"

    # Map frontend model IDs to exact OpenRouter/External endpoints
    model_map = {
        "gemini": "google/gemini-flash-1.5",
        "opus": "anthropic/claude-3-opus",
        "sonnet": "anthropic/claude-3.5-sonnet",
        "gpt4": "openai/gpt-4o",
        "gemini-free": "google/gemini-flash-1.5-exp",
        "llama-70b-free": "meta-llama/llama-3.3-70b-instruct",
        "llama-8b-free": "meta-llama/llama-3.2-3b-instruct",
        "deepseek-free": "deepseek/deepseek-chat",
        "mistral-nemo-free": "mistralai/mistral-nemo",
        "qwen-coder-free": "qwen/qwen-2.5-coder-32b-instruct",
        "magicoder": "qwen/qwen-2.5-coder-32b-instruct",
    }
    
    # Use mapped name if available, otherwise use original
    target_model = model_map.get(model_name, model_name)
    
    response_text = None
    errors = []

    # ── Strategy 1: Try native Gemini SDK if key is available ──
    if gemini_api_key and response_text is None:
        try:
            if not gemini_model:
                genai.configure(api_key=gemini_api_key)
                gemini_model = genai.GenerativeModel('gemini-2.0-flash')

            gemini_prompt = f"{system_prompt}\n\n{user_prompt}"
            gemini_response = await gemini_model.generate_content_async(gemini_prompt)
            response_text = gemini_response.text
            print(f"[AI] Gemini SDK success for mode={mode}")
        except Exception as e:
            errors.append(f"Gemini SDK: {e}")
            print(f"[AI] Gemini SDK failed: {e}")

    # ── Strategy 2: Try OpenRouter API if key is available ──
    if api_key and response_text is None:
        try:
            print(f"[AI] Trying OpenRouter: {api_base}/chat/completions model={target_model}")
            timeout_config = httpx.Timeout(60.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                response = await client.post(
                    f"{api_base}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": target_model,
                        "messages": [
                            {"role": "user", "content": f"{system_prompt}\n\n{user_prompt}"}
                        ] if "gemma" in target_model.lower() else [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.2 if mode in ["debug", "livefix"] else 0.7,
                        "max_tokens": 2048,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    print(f"[AI] OpenRouter success for mode={mode}")
                else:
                    errors.append(f"OpenRouter ({response.status_code}): {response.text[:200]}")
                    print(f"[AI] OpenRouter error {response.status_code}: {response.text[:200]}")
        except Exception as e:
            errors.append(f"OpenRouter: {e}")
            print(f"[AI] OpenRouter failed: {e}")

    # ── Strategy 3: Try Groq API as fallback ──
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key and response_text is None:
        try:
            print(f"[AI] Trying Groq fallback")
            timeout_config = httpx.Timeout(60.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.2 if mode in ["debug", "livefix"] else 0.7,
                        "max_tokens": 2048,
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    print(f"[AI] Groq success for mode={mode}")
                else:
                    errors.append(f"Groq ({response.status_code}): {response.text[:200]}")
                    print(f"[AI] Groq error {response.status_code}")
        except Exception as e:
            errors.append(f"Groq: {e}")
            print(f"[AI] Groq failed: {e}")

    # ── Final fallback: Return clear error instead of hardcoded fake analysis ──
    if response_text is None:
        configured_keys = []
        if gemini_api_key:
            configured_keys.append("GEMINI_API_KEY")
        if api_key:
            configured_keys.append("OPENROUTER_API_KEY")
        if groq_key:
            configured_keys.append("GROQ_API_KEY")

        if not configured_keys:
            response_text = (
                "**⚠️ No AI API keys configured.**\n\n"
                "To enable AI analysis, set one of these environment variables:\n"
                "- `GEMINI_API_KEY` — Free tier available at [Google AI Studio](https://aistudio.google.com/apikey)\n"
                "- `OPENROUTER_API_KEY` — Multi-model access at [OpenRouter](https://openrouter.ai)\n"
                "- `GROQ_API_KEY` — Fast inference at [Groq](https://console.groq.com)\n\n"
                "Add the key to your Railway environment variables and redeploy."
            )
        else:
            error_details = "\n".join(f"- {e}" for e in errors)
            response_text = (
                f"**⚠️ AI analysis failed.**\n\n"
                f"Configured keys: {', '.join(configured_keys)}\n\n"
                f"Errors encountered:\n{error_details}\n\n"
                f"Please check your API key validity and network connectivity."
            )

    processing_time = round(time.time() - start_time, 2)
    
    return AnalyzeResponse(
        response=response_text,
        mode=mode,
        model=model_name,
        tokens=len(response_text) // 4,
        processingTime=processing_time
    )

@router.websocket("/ws/livefix")
async def websocket_livefix(websocket: WebSocket):
    await websocket.accept()
    
    # We use Groq specifically for LiveFix as per user request
    api_base = "https://api.groq.com/openai/v1"
    api_key = os.getenv("GROQ_API_KEY", "")
    timeout_config = httpx.Timeout(60.0, connect=10.0)
    
    try:
        while True:
            # Wait for messages from the client
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                code = payload.get("code", "")
                language = payload.get("language", "javascript")
                file_name = payload.get("file_name", "Unknown")
                cursor_pos = payload.get("cursor_pos", None)
                mode = payload.get("mode", "livefix")
                model_name = "llama-3.3-70b-versatile" # Default fast groq model
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format payload"})
                continue
                
            if not code:
                continue
                
            mode_instruction = "Analyze the user's code for bugs, errors, and optimizations."
            if mode == "debug":
                mode_instruction = "Focus STRICTLY on finding bugs, syntax errors, and logical issues. Ignore incomplete typing."
            elif mode == "enhance":
                mode_instruction = "Focus STRICTLY on code quality, readability, performance, and best practices. Do NOT suggest docstrings or type hints."
            elif mode == "expand":
                mode_instruction = "Focus on identifying areas where features are missing or could be expanded."
            elif mode == "teaching":
                mode_instruction = "Focus on pointing out issues but DO NOT provide the exact code fix. Instead, provide hints or questions in the 'message' and leave 'suggestion' as an empty string."
            elif mode == "livefix":
                mode_instruction = "Act as a silent monitor. ONLY flag critical syntax errors, obvious logical bugs, or severe anti-patterns. IGNORE missing docstrings, type hints, or incomplete typing."
            
            persona = (
                f"You are an expert Real-Time AI Coding Advisor ({mode} mode). "
                f"{mode_instruction} "
                f"CRITICAL: ALL 'suggestion' values MUST be written strictly in {language.upper()} syntax. DO NOT provide Javascript fixes for Python files. "
                "Provide ONLY valid JSON as a response, NO Markdown formatting, NO explanations. "
                "You MUST NOT wrap the JSON in ```json blocks. "
                "The JSON must be an array of objects. Each object must have: "
                "'line' (integer corresponding to the 1-indexed line number in the source), "
                "'severity' (string: 'error', 'warning', or 'info'), "
                "'message' (string: concise description of the issue), "
                "and 'suggestion' (string: the exact replacement code for the line/lines, or empty if teaching mode). "
                "If there are no critical issues relevant to this mode, you MUST return an empty array []. "
                "Do NOT include any text outside the JSON array."
            )
            
            user_prompt = f"File Context: {file_name}\nLanguage: {language}\nCode:\n{code}\n"
            if cursor_pos:
                 user_prompt += f"Cursor is at line: {cursor_pos.get('lineNumber')}, column: {cursor_pos.get('column')}\n"
                 
            system_prompt = persona

            await websocket.send_json({"type": "status", "message": "Analyzing..."})

            # Try Gemini SDK first for WebSocket livefix if no Groq key
            if not api_key and gemini_api_key:
                try:
                    if not gemini_model:
                        genai.configure(api_key=gemini_api_key)
                        gemini_model = genai.GenerativeModel('gemini-2.0-flash')

                    gemini_prompt = f"{system_prompt}\n\n{user_prompt}"
                    gemini_response = await gemini_model.generate_content_async(gemini_prompt)
                    full_response = gemini_response.text
                    await websocket.send_json({"type": "chunk", "text": full_response})
                    await websocket.send_json({"type": "done", "full_text": full_response})
                    continue
                except Exception as e:
                    print(f"WS Gemini Exception: {e}")
                    await websocket.send_json({"type": "error", "message": f"Gemini failed: {str(e)}"})
                    continue

            # Groq streaming path
            if not api_key:
                await websocket.send_json({"type": "error", "message": "No AI API key configured (GROQ_API_KEY or GEMINI_API_KEY required)"})
                continue
            
            # Groq model mapping
            target_model = "llama-3.3-70b-versatile"
            
            # Start streaming response
            try:
                async with httpx.AsyncClient(timeout=timeout_config) as client:
                    async with client.stream(
                        "POST", 
                        f"{api_base}/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "model": target_model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt}
                            ],
                            "temperature": 0.1,
                            "max_tokens": 2048,
                            "stream": True
                        }
                    ) as response:
                        if response.status_code != 200:
                            error_text = await response.aread()
                            print(f"WS API Error: {error_text}")
                            if response.status_code == 429:
                                await websocket.send_json({"type": "error", "message": "API Rate Limit Exceeded. Please wait a moment."})
                            else:
                                await websocket.send_json({"type": "error", "message": f"API Error {response.status_code}"})
                            continue
                            
                        full_response = ""
                        async for chunk in response.aiter_lines():
                            if chunk.startswith("data: "):
                                data_str = chunk[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    json_data = json.loads(data_str)
                                    delta = json_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if delta:
                                        full_response += delta
                                        await websocket.send_json({"type": "chunk", "text": delta})
                                except json.JSONDecodeError:
                                    pass
                                    
                        await websocket.send_json({"type": "done", "full_text": full_response})
                        
            except Exception as e:
                print(f"WS Stream Exception: {e}")
                await websocket.send_json({"type": "error", "message": f"Stream failed: {str(e)}"})
                
    except WebSocketDisconnect:
        print("LiveFix Client disconnected")
