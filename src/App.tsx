import { useState } from "react";

export default function App() {
  const [input, setInput] = useState(`{
  "client": {
    "brand": "Example Brand",
    "industry": "Digital Marketing",
    "goal": "Grow Instagram"
  }
}`);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  async function runAudit() {
    setLoading(true);
    setOutput("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input
      });

      const data = await res.text();
      setOutput(data);
    } catch (e) {
      setOutput("❌ Error running audit");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: 32, fontFamily: "Inter, sans-serif" }}>
      <h1>AuraPost Sutradhar</h1>
      <p>Strategic Social Media Audit Tool</p>

      <h3>Input JSON</h3>
      <textarea
        style={{ width: "100%", height: 200 }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <br /><br />
      <button onClick={runAudit} disabled={loading}>
        {loading ? "Analyzing..." : "Run Audit"}
      </button>

      <h3 style={{ marginTop: 30 }}>Output</h3>
      <pre
        style={{
          background: "#f5f5f5",
          padding: 16,
          whiteSpace: "pre-wrap"
        }}
      >
        {output}
      </pre>
    </div>
  );
}
