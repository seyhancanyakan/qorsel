// Test status API directly
const promptId = "6c64a4d2-0fa1-4589-b41e-2a2037ea4574";

console.log("Testing ComfyUI directly...");
fetch(`http://127.0.0.1:8188/history/${promptId}`)
  .then(r => r.json())
  .then(data => {
    console.log("ComfyUI Response:");
    console.log("  Keys:", Object.keys(data));
    console.log("  Has prompt:", promptId in data);
    if (data[promptId]) {
      console.log("  Status:", data[promptId].status?.status_str);
      console.log("  Completed:", data[promptId].status?.completed);
      console.log("  Outputs:", Object.keys(data[promptId].outputs || {}));
    }
  })
  .catch(err => console.error("ComfyUI Error:", err));

console.log("\nTesting Next.js API...");
fetch(`http://localhost:3000/api/qwen-edit/status?prompt_id=${promptId}`)
  .then(r => r.json())
  .then(data => {
    console.log("Next.js API Response:", data);
  })
  .catch(err => console.error("Next.js API Error:", err));
