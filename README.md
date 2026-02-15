# Health Call Failure Analyzer

An AI tool that reads customer–agent call conversations and explains:

- What was the purpose of the call

- Why the goal was not achieved

- How the agent can improve next time

It works like a smart call-center coach — instead of manually checking calls, AI audits them automatically.

## Features

Detect call purpose (sales, support, booking, inquiry, complaint, etc.)

Identify success or failure of the call

Explain why the agent failed or succeeded

Provide actionable improvement plan

Structured AI analysis output

Works on conversation JSON (role + content messages)

Helps improve conversions and agent performance


## Project Versions

This project has two implementations:

### 1️. health_call_agent (Python Version)

Tech Stack

Python
FastAPI
LangGraph
Gemini (LLM)
Streamlit (UI)

Use Case
Backend-focused AI pipeline + quick UI for testing and demos.

### 2. health_call_agent_node (JavaScript Version)

Tech Stack

Node.js
Express
React
LangGraph.js

Use Case
Frontend-friendly and production-style web application.

### Input Format

Conversation must be provided as JSON:

[
  {"role": "agent", "content": "Hello, how may I help you?"},
  {"role": "customer", "content": "I wanted to know the price of the plan"},
  {"role": "agent", "content": "It costs 4999"},
  {"role": "customer", "content": "Okay I will think and call later"}
]

### Goal

Help companies understand:

Not just what happened in a call — but why the deal failed and how to fix it.
