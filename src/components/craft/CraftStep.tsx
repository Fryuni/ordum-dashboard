interface StepInput {
  name: string;
  total_needed: number;
  available: number;
  deficit: number;
}

interface Step {
  depth: number;
  output_name: string;
  craft_count: number;
  total_output: number;
  building_type: string;
  building_tier: number;
  skill_requirements: { skill: string; level: number }[];
  tool_requirements: { tool: string; level: number }[];
  inputs: StepInput[];
}

export default function CraftStep({ step }: { step: Step }) {
  return (
    <div class="timeline-step">
      <div class="timeline-node">{step.depth + 1}</div>
      <div class="timeline-card">
        <div class="step-header">
          <span class="step-title">{step.output_name}</span>
          <span class="step-qty">×{step.craft_count} craft{step.craft_count > 1 ? 's' : ''} → {step.total_output} output</span>
          <div class="badges">
            {step.building_type && (
              <span class="badge">🏠 {step.building_type}{step.building_tier ? ' T' + step.building_tier : ''}</span>
            )}
            {(step.skill_requirements || []).map(s => (
              <span class="badge" key={s.skill}>⚡ {s.skill} Lv{s.level}</span>
            ))}
            {(step.tool_requirements || []).map(t => (
              <span class="badge" key={t.tool}>🔧 {t.tool}</span>
            ))}
          </div>
        </div>
        <div class="input-grid">
          {step.inputs.map(inp => {
            const d = inp.deficit > 0;
            return (
              <div class={`input-card ${d ? 'deficit' : 'ok'}`} key={inp.name}>
                <span class="input-name">{inp.name}</span>
                <span class={`input-qty ${d ? 'deficit' : 'ok'}`}>
                  {inp.available || 0} / {inp.total_needed}{d ? ` (need ${inp.deficit})` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
