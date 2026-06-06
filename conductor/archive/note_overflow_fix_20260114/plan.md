# Plan: Fix Note Content Overflow (Desktop)

## Phase 1: CSS Audit & Fix [checkpoint: 037aa47]
- [x] Task: Audit `public/style.css` for any accidental `height` or `max-height` rules on the `.note` class. [037aa47]
- [x] Task: Ensure the `.note` grid is configured to allow rows to grow naturally with content. [037aa47]
- [x] Task: Conductor - User Manual Verification 'Phase 1: CSS Audit & Fix' (Protocol in workflow.md) [037aa47]

## Phase 2: Verification & Cleanup [checkpoint: 7d0b682]
- [x] Task: Verify that extremely long notes expand correctly without overflow. [7d0b682]
- [x] Task: Verify that single-line notes remain stable at `2.8rem`. [7d0b682]
- [x] Task: Ensure no regressions in mobile view or hover stability. [7d0b682]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Verification & Cleanup' (Protocol in workflow.md) [7d0b682]
