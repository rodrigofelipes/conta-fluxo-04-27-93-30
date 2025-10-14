export type EfficiencyStatus = 'on_track' | 'attention' | 'critical' | 'no_data';

export interface EfficiencyComputation {
  plannedHours: number;
  executedHours: number;
  hoursBalance: number;
  efficiency: number;
  coverage: number;
  status: EfficiencyStatus;
}

export interface EfficiencyInput {
  plannedHours: number;
  executedHours: number;
}

function normalizeHours(value: number | null | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Number(value));
}

export function calculateEfficiency(planned: number, executed: number): EfficiencyComputation {
  const plannedHours = normalizeHours(planned);
  const executedHours = normalizeHours(executed);

  if (plannedHours === 0 && executedHours === 0) {
    return {
      plannedHours,
      executedHours,
      hoursBalance: 0,
      efficiency: 0,
      coverage: 0,
      status: 'no_data'
    };
  }

  if (plannedHours === 0) {
    return {
      plannedHours,
      executedHours,
      hoursBalance: executedHours,
      efficiency: 100,
      coverage: 1,
      status: 'attention'
    };
  }

  const hoursBalance = Number((executedHours - plannedHours).toFixed(1));
  let efficiencyValue: number;

  if (executedHours <= plannedHours) {
    efficiencyValue = (executedHours / plannedHours) * 100;
  } else {
    const overrunRatio = (executedHours - plannedHours) / plannedHours;
    efficiencyValue = Math.max(0, 100 - overrunRatio * 100);
  }

  const normalizedEfficiency = Number(efficiencyValue.toFixed(1));
  const coverage = Number(Math.min(executedHours / plannedHours, 1).toFixed(2));

  let status: EfficiencyStatus;
  if (normalizedEfficiency >= 90) {
    status = 'on_track';
  } else if (normalizedEfficiency >= 75) {
    status = 'attention';
  } else {
    status = 'critical';
  }

  return {
    plannedHours: Number(plannedHours.toFixed(1)),
    executedHours: Number(executedHours.toFixed(1)),
    hoursBalance,
    efficiency: normalizedEfficiency,
    coverage,
    status
  };
}

export function mergeEfficiency(inputs: EfficiencyInput[]): EfficiencyComputation {
  const totals = inputs.reduce(
    (acc, current) => {
      acc.planned += normalizeHours(current.plannedHours);
      acc.executed += normalizeHours(current.executedHours);
      return acc;
    },
    { planned: 0, executed: 0 }
  );

  return calculateEfficiency(totals.planned, totals.executed);
}
