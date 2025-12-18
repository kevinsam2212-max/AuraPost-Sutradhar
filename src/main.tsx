
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// -- CONSTANTS --

// Using TypeScript Interface in System Instruction reduces token count and ambiguity, 
// helping to prevent RPC errors on complex prompts.
const SYSTEM_INSTRUCTION = `You are AuraPost Sutradhar, a strategic social media planning engine.
Your goal is to analyze the input JSON (client details + links + optional competitors) and return a SINGLE valid JSON object as the output.

RULES:
1. Use the "googleSearch" tool to research the provided URLs (client & competitors) to understand the niche, audience, and content performance.
2. Do NOT output markdown, explanations, or code blocks. Just the raw JSON string.
3. If "previousResult" is provided, perform a re-audit comparison (populate "improvementSummary").
4. If "competitors" are provided, analyze them based on observable signals (visuals, tone, topics) and populate "competitorBenchmark".
5. Strictly follow the TypeScript interface below for your JSON output structure.

interface Output {
  persona: {
    role: string;
    niche: string;
    subNiche: string;
    audience: string;
    toneStyle: string;
    valueProp: string;
    maturityLevel: "Beginner" | "Emerging" | "Professional" | "Expert" | "Authority";
    summary: string;
  };
  audienceInsight: {
    coreProblems: string[];
    desiredOutcomes: string[];
    commonObjections: string[];
    keywords: string[];
    buyingTriggers: string[];
