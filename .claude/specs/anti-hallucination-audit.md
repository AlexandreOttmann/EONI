# 🧠 Anti-Hallucination Chat Agent System (RAG + Structured Approach)

This guide combines:

- ✅ Improved **retrieval strategy**
- ✅ **3-step prompt pipeline** (validation → extraction → answer)
- ✅ Practical implementation tips

Goal:

> **Minimize hallucinations while keeping high-quality answers**

---

# 🚨 Why hallucinations happen

Even with strict prompts, hallucinations occur because:

1. **Bad retrieval**
   - Missing or irrelevant context
2. **Chunk-based RAG**
   - Information split across chunks
3. **Unstructured data**
   - Model guesses relationships
4. **Single-step answering**
   - Model fills gaps automatically

---

# ✅ Core Solution

Move from:


Basic RAG (chunks → answer)


To:


Validation → Fact Extraction → Controlled Answer

Structured product data


---

# 🧩 1. Use Structured Data (CRITICAL)

## ❌ Bad (chunks)


"Trip lasts 12 days..."
"Price is 3800€..."


## ✅ Good (product-level document)

```json
{
  "title": "Japan Cultural Journey",
  "price": 3800,
  "duration_days": 12,
  "description": "...",
  "url": "..."
}

👉 Embed this as a single semantic unit.

🧩 2. Retrieval Best Practices

Use top 3–5 results max

Combine:

vector search

keyword search (hybrid)

Prefer product-level docs over chunks

🧠 3. Prompt Pipeline (DROP-IN)
🧪 Step 1 — Validation Prompt
You are a strict information validator.

Your task is to determine whether the provided context contains enough explicit information to answer the user's question.

Rules:
- Only answer YES or NO
- YES = the answer can be directly derived from the context
- NO = the context is missing required information
- Do NOT guess
- Do NOT infer
- Do NOT use outside knowledge

Question:
{{query}}

Context:
{{context}}
Output:
YES

or

NO
❌ If NO → fallback
This specific information is not provided in the available sources.
🧩 Step 2 — Fact Extraction Prompt
You are an information extraction engine.

Extract ONLY the facts from the context that are directly relevant to the question.

Rules:
- ONLY extract information explicitly present in the context
- DO NOT rephrase beyond clarity
- DO NOT infer or complete missing data
- Keep facts atomic and precise
- Include numbers, dates, and constraints exactly as written
- For each fact, include the source URL if available

Return JSON in this format:

{
  "facts": [
    {
      "text": "fact here",
      "source": "url or null"
    }
  ]
}

If no relevant facts are found, return:

{
  "facts": []
}

Question:
{{query}}

Context:
{{context}}
🧩 Step 3 — Final Answer Prompt
You are a helpful assistant.

Answer the user using ONLY the provided facts.

Rules:
- Use ONLY the facts provided
- DO NOT add any external knowledge
- DO NOT infer or assume anything
- If the facts are incomplete, explicitly say what is missing
- Be concise and clear
- Group related information logically

At the end, list the sources used.

If there are no facts, say:
"This specific information is not provided in the available sources."

User question:
{{query}}

Facts:
{{facts}}
⚙️ 4. Pipeline Flow
User Query
   ↓
Retrieve top 3–5 documents
   ↓
Validation (YES/NO)
   ↓
If YES → Extract facts
   ↓
Generate answer
   ↓
Return response
🧠 5. Key Enhancements
✅ Reduce hallucinations

Validation gate

Fact-only extraction

Controlled generation

✅ Improve accuracy

Structured product data

Hybrid search (vector + keyword)

Metadata filtering

✅ Improve trust

Always show sources

Explicitly say when data is missing

⚡ 6. Important Rules
Rule 1 — Never rely on chunks only

Use structured product documents.

Rule 2 — Limit context

Too much context = more hallucination.

Rule 3 — Never answer directly

Always:

extract → answer
Rule 4 — Accept “I don’t know”

This increases trust.

🔥 7. Optional Improvements
Add confidence
{
  "text": "...",
  "source": "...",
  "confidence": "high"
}
Deduplicate facts before answering
Add fallback semantic search

If no results:

return closest matches

🏁 TL;DR

To fix hallucinations:

❌ Stop relying only on chunks

✅ Use structured product data

✅ Add validation step

✅ Extract facts before answering

✅ Limit context

✅ Use hybrid search

🚀 Final Insight

You’re not building a chatbot.

You’re building:

A system that forces the model to separate truth from generation

That’s what makes it reliable.