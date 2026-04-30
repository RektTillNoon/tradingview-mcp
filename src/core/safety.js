export const SAFETY_MODES = new Set(['full_control', 'read_only', 'confirm_mutations']);

export const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
};

export const mutationAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

export const destructiveMutationAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
};

export function getSafetyMode(env = process.env) {
  const mode = env.TV_MCP_MODE || 'full_control';
  return SAFETY_MODES.has(mode) ? mode : 'full_control';
}

export function blockedMutation({ mode, tool, args }) {
  return {
    success: false,
    blocked: true,
    mode,
    tool,
    args,
    message: `Mutation blocked by TV_MCP_MODE=${mode}. Set TV_MCP_MODE=full_control to execute this tool.`,
  };
}

export function plannedMutation({ mode, tool, args }) {
  return {
    success: true,
    blocked: false,
    requires_confirmation: true,
    mode,
    tool,
    args,
    message: 'Mutation not executed. Re-run with TV_MCP_MODE=full_control to apply this planned action.',
  };
}

export async function guardMutation({ tool, args = {}, env = process.env, execute }) {
  const mode = getSafetyMode(env);
  if (mode === 'read_only') {
    return blockedMutation({ mode, tool, args });
  }
  if (mode === 'confirm_mutations') {
    return plannedMutation({ mode, tool, args });
  }
  return execute();
}
