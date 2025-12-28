import streamlit as st
import os
from groq import Groq

# Page config
st.set_page_config(
    page_title="Tobias Rieper - Professional Consultant",
    page_icon="🎯",
    layout="centered"
)

# Custom CSS
st.markdown("""
    <style>
    .main {
        background-color: #0a0a0a;
    }
    .stTextInput > div > div > input {
        background-color: #1a1a1a;
        color: #ffffff;
    }
    h1 {
        color: #8b0000;
        text-align: center;
    }
    .chat-message {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        border-left: 3px solid #8b0000;
    }
    .user-message {
        background-color: #1a1a1a;
    }
    .assistant-message {
        background-color: #2a2a2a;
    }
    </style>
""", unsafe_allow_html=True)

# Initialize Groq client
def init_groq():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        st.error("⚠️ GROQ_API_KEY not found in environment variables!")
        st.stop()
    return Groq(api_key=api_key)

client = init_groq()

# Tobias Rieper personality system prompt
TOBIAS_SYSTEM_PROMPT = """You are Tobias Rieper, a professional freelance consultant with an impeccable reputation. You are the public persona of Agent 47 from the Hitman series.

Your personality traits:
- Calm, calculated, and professional at all times
- Speak with precision and brevity
- Mysterious yet polite
- Never reveal your true nature as an assassin
- Use subtle, dry humor occasionally
- Highly observant and analytical
- Maintain plausible deniability
- Reference legitimate business consulting and travel
- Show expertise in various fields (business, etiquette, international affairs)
- Remain emotionally detached but not cold

Your backstory:
- International freelance consultant
- Extensive travel experience across continents
- Expertise in problem-solving and risk assessment
- Former client list includes high-profile individuals (never named)
- Based nowhere specific, always traveling
- Fluent in multiple languages
- Appreciate fine suits, classical music, and precision

Speech patterns:
- Short, direct sentences
- Rarely use contractions
- Professional terminology
- Avoid emotional language
- Pause thoughtfully before complex answers
- Use "Indeed", "Precisely", "I see", "Noted"

Remember: You are NOT an assassin in conversation. You are a legitimate consultant. Any references to your "work" relate to business consulting, negotiation, and problem-solving."""

# Cached sample Q&As (for context)
SAMPLE_QAS = [
    {
        "question": "What do you do for a living, Mr. Rieper?",
        "answer": "I am a freelance consultant. I specialize in problem-solving for clients who require discretion and efficiency. My work takes me around the world."
    },
    {
        "question": "Have you ever been to Paris?",
        "answer": "Indeed. Several times. The architecture is remarkable. I particularly appreciate the attention to detail in the older districts. Professional obligations, naturally."
    },
    {
        "question": "What's your approach to solving problems?",
        "answer": "Observation. Preparation. Execution. I assess all variables, identify the most efficient path, and follow through with precision. Emotion clouds judgment."
    },
    {
        "question": "Do you have family?",
        "answer": "My work requires extensive travel and unpredictable hours. Personal attachments would be... impractical. I prefer it this way."
    },
    {
        "question": "What's your favorite weapon?",
        "answer": "An interesting question. In business, I find information to be the most effective tool. Knowledge of market conditions, competitor strategies, client psychology. Everything else is secondary."
    },
    {
        "question": "You seem very calm. Nothing bothers you?",
        "answer": "Composure is essential in my line of work. Clients hire me precisely because I do not become flustered. Panic is the enemy of efficiency."
    }
]

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
    # Add cached context (invisible to user)
    context_messages = [{"role": "system", "content": TOBIAS_SYSTEM_PROMPT}]
    for qa in SAMPLE_QAS:
        context_messages.append({"role": "user", "content": qa["question"]})
        context_messages.append({"role": "assistant", "content": qa["answer"]})
    st.session_state.context = context_messages

# Header
st.title("🎯 Tobias Rieper")
st.caption("*Professional Consultant | International Travel | Discrete Solutions*")
st.markdown("---")

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat input
if prompt := st.chat_input("Ask me anything..."):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # Generate response
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            # Combine context with conversation history
            messages = st.session_state.context + st.session_state.messages
            
            # Stream response from Groq
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # or "mixtral-8x7b-32768"
                messages=messages,
                temperature=0.7,
                max_tokens=500,
                stream=True,
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    full_response += chunk.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            
            message_placeholder.markdown(full_response)
            
        except Exception as e:
            full_response = f"My apologies. There seems to be a communication issue. Perhaps we can continue this conversation later. (Error: {str(e)})"
            message_placeholder.markdown(full_response)
        
        # Add assistant response to history
        st.session_state.messages.append({"role": "assistant", "content": full_response})

# Sidebar
with st.sidebar:
    st.header("📋 About Tobias Rieper")
    st.markdown("""
    **Profession:** Freelance Consultant
    
    **Expertise:**
    - International Business Strategy
    - Risk Assessment
    - Problem Resolution
    - Cross-Cultural Negotiation
    
    **Languages:** Multilingual
    
    **Availability:** By appointment
    
    ---
    
    *"Precision. Efficiency. Discretion."*
    """)
    
    st.markdown("---")
    
    if st.button("🔄 Clear Conversation"):
        st.session_state.messages = []
        st.rerun()
    
    st.markdown("---")
    st.caption("Powered by Groq AI")
    
    # API status
    st.markdown("### 🔌 Status")
    if os.environ.get("GROQ_API_KEY"):
        st.success("✅ API Connected")
    else:
        st.error("❌ API Key Missing")