# Workflow Visualization Guide

The workflow diagram is defined in `DATAFLOW.dot`.

## Generate PNG (Graphviz)

1. Install Graphviz.
2. Run:

```bash
dot -Tpng DATAFLOW.dot -o DATAFLOW.png
```

## Generate SVG

```bash
dot -Tsvg DATAFLOW.dot -o DATAFLOW.svg
```

## Current Workflow

- Agent 1: Purpose detection
- Agent 2: Dual failure analysis
  - Business/Operational
  - Agentic Workflow
- Decision gate:
  - Agentic issues present -> Agent 3 executes
  - No agentic issues -> frontend dashboard only
- Agent 3: Workflow improvement actions
- Dashboard: displays all outputs
