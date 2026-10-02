# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Dexie.js (IndexedDB local storage), Supabase JS, Model Context Protocol (MCP) server.

## Users

Double engineering students (Aeroespacial + Software) and multi-university students managing heavy course loads, concurrent schedules, and complex deliverables.

## Product Purpose

PURE OS is a high-density academic management system built to calculate real net free time, recommend the Minimum Effective Dose (DME) of weekly study hours per subject, detect schedule overlaps, and track cross-degree syllabus synergies without overstudying or burnout.

## Positioning

Quantitative efficiency engine for dual-degree academics. Focuses strictly on time calculation, grade targets, deliverable deadlines, and syllabus overlap matrix rather than generic task checklists or marketing fluff.

## Operating Context

Daily academic management on desktop and mobile web. Requires fast keyboard & touch access, clear visual hierarchy, high density, and 100% functional scanability under light and dark ambient conditions.

## Capabilities and Constraints

- Local-first architecture (Dexie.js IndexedDB) for offline availability and zero load latency.
- Exact algorithm calculations for DME study hours and net free time (168h weekly balance).
- Conflict detector for multi-institution schedule overlaps.
- Integrated cross-degree syllabus synergy matrix.

## Brand Commitments

- Name: PURE OS — Academic OS.
- Voice: Precise, quantitative, direct, software-tool aesthetic (Linear / Raycast inspired).
- Anti-patterns banned: Zero marketing slogans ("Eficiencia Académica", "Semestre Activo"), zero decorative filler badges, zero redundant eyebrows, zero mystery glass halos. The one sanctioned exception is the daily quote on Hoy, a Latin phrase shown with its translation and source (see Product Principle 1); it is not a slogan.

## Product Principles

1. **Direct Operational Utility:** Every element on screen must earn its place. If an element doesn't show data or trigger an action, strip it. Sole exception (constitution 1.1.0, Principle V): one daily quote on Hoy, made of the Latin original, its translation and its source. It is plain text with no icon, animation or accent color, it is loaded only through the MCP tool `manage_quotes`, and the day's quote is picked deterministically from the local date.
2. **Minimum Effective Dose (DME):** Protect net free time by optimizing study hours to deliverable weight and complexity.
3. **Impeccable Software Craft:** Precise borders, calibrated slate/obsidian palette, sharp typographic scale, and functional micro-interactions.
