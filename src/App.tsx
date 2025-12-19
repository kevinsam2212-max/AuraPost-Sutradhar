import { useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAuraPost = async () => {
    setLoading(true);
    setError("");
    setOutput("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: input,
      });

      if (!res.ok) {
        throw new Error("API error");
      }

      const text = await res.text();
      setOutput(text);
    } catch (err) {
      setError("Something went wrong. Check API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>AuraPost Sutradhar</h1>
      <p>AI Social Media Planning Engine</p>

      <textarea
        rows={10}
        style={{ width: "100%", marginTop: 10 }}
        placeholder="Paste input JSON here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <br /><br />

      <button onClick={runAuraPost} disabled={loading}>
        {loading ? "Generating..." : "Generate Output"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {output && (
        <>
          <h3>Output</h3>
          <pre
            style={{
              background: "#f4f4f4",
              padding: 15,
              whiteSpace: "pre-wrap",
            }}
          >
            {output}
          </pre>
        </>
      )}
    </div>
  );
}
