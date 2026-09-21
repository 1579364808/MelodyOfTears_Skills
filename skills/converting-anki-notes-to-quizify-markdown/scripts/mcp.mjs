// Minimal JSON-RPC client for an MCP server over Streamable HTTP (e.g. the
// ankimcp.ai desktop addon at http://127.0.0.1:3141/).
// Usage: import { mcpCall } from './mcp.mjs';  const res = await mcpCall('notes_info', { notes: [id] });
// Resolves to the tool's structured payload (object). Throws on connection failure.

const DEFAULT_URL = process.env.ANKI_MCP_URL || 'http://127.0.0.1:3141/';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

let _id = 1;

function tryParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// An MCP tool response is { result: { structuredContent?, content?: [{type:'text',text:'<json>'}] } }
// — the actual payload is structuredContent when present, otherwise a JSON string in content[0].text.
export async function mcpCall(name, args, url = DEFAULT_URL) {
  const r = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: _id++, method: 'tools/call', params: { name, arguments: args } }),
  });
  const t = await r.text();
  let res = null;
  for (const line of t.split('\n')) {
    if (line.startsWith('data:')) {
      const p = tryParse(line.slice(5).trim(), null);
      if (p) res = p;
    }
  }
  if (!res) res = tryParse(t, null);
  if (!res) throw new Error('unparseable MCP response');
  if (res.error) throw new Error('MCP error: ' + JSON.stringify(res.error).slice(0, 200));
  if (res.result?.isError) {
    throw new Error('tool error: ' + JSON.stringify(res.result.structuredContent ?? res.result.content?.[0]?.text ?? '').slice(0, 200));
  }
  return res.result?.structuredContent ?? tryParse(res.result?.content?.[0]?.text ?? '{}', {});
}

// Discover tools: const names = await listTools();
export async function listTools(url = DEFAULT_URL) {
  const init = await mcpCallRaw('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '1' } }, url);
  void init;
  const res = await mcpCallRaw('tools/list', {}, url);
  return (res?.result?.tools || []).map((t) => t.name);
}

async function mcpCallRaw(method, params, url) {
  const r = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: _id++, method, params }),
  });
  const t = await r.text();
  for (const line of t.split('\n')) {
    if (line.startsWith('data:')) {
      const p = tryParse(line.slice(5).trim(), null);
      if (p) return p;
    }
  }
  return tryParse(t, null);
}