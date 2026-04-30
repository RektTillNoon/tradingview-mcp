import { z } from 'zod';
import { guardMutation, mutationAnnotations, readOnlyAnnotations } from '../core/safety.js';

/**
 * Shared MCP response formatting helper.
 * All tool files use this instead of manually constructing MCP responses.
 */
export function jsonResult(obj, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
    ...(isError && { isError: true }),
  };
}

export function objectSchema(shape = {}) {
  return z.object(shape);
}

export function registerJsonTool(server, name, description, shape, handler, options = {}) {
  const annotations = options.mutating ? mutationAnnotations : readOnlyAnnotations;
  server.registerTool(
    name,
    {
      description,
      inputSchema: objectSchema(shape),
      annotations: options.annotations || annotations,
    },
    async (args) => {
      const run = async () => {
        try {
          return jsonResult(await handler(args || {}));
        } catch (err) {
          return jsonResult({ success: false, error: err.message }, true);
        }
      };

      if (!options.mutating) return run();

      try {
        const result = await guardMutation({
          tool: name,
          args: args || {},
          execute: async () => handler(args || {}),
        });
        return jsonResult(result, result?.blocked === true);
      } catch (err) {
        return jsonResult({ success: false, error: err.message }, true);
      }
    },
  );
}
