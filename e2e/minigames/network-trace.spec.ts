import { test, expect, type Page } from "@playwright/test";
import { openTraining, unlockMinigames } from "../helpers/training";
import { skipOnboarding } from "../helpers/setup";

// BFS solver — finds shortest path through the maze and returns arrow key sequence
async function solveMaze(page: Page): Promise<string[]> {
  const mazeEl = page.locator('[data-testid="maze-data"]');
  const rows = Number(await mazeEl.getAttribute("data-rows"));
  const cols = Number(await mazeEl.getAttribute("data-cols"));
  const start: [number, number] = JSON.parse((await mazeEl.getAttribute("data-start"))!);
  const end: [number, number] = JSON.parse((await mazeEl.getAttribute("data-end"))!);
  const walls: { n: number; s: number; e: number; w: number }[][] = JSON.parse(
    (await mazeEl.getAttribute("data-walls"))!,
  );

  const key = (r: number, c: number) => `${r},${c}`;
  const visited = new Set<string>();
  const parent = new Map<string, { from: string; arrow: string } | null>();
  const queue: [number, number][] = [start];
  visited.add(key(start[0], start[1]));
  parent.set(key(start[0], start[1]), null);

  const dirs = [
    { dr: -1, dc: 0, wall: "n" as const, arrow: "ArrowUp" },
    { dr: 1, dc: 0, wall: "s" as const, arrow: "ArrowDown" },
    { dr: 0, dc: -1, wall: "w" as const, arrow: "ArrowLeft" },
    { dr: 0, dc: 1, wall: "e" as const, arrow: "ArrowRight" },
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (r === end[0] && c === end[1]) break;

    for (const { dr, dc, wall, arrow } of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (walls[r][c][wall]) continue; // wall blocks this direction
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, { from: key(r, c), arrow });
      queue.push([nr, nc]);
    }
  }

  // Trace back from end to start to get arrow sequence
  const arrows: string[] = [];
  let cur = key(end[0], end[1]);
  while (parent.get(cur) != null) {
    const p = parent.get(cur)!;
    arrows.unshift(p.arrow);
    cur = p.from;
  }

  return arrows;
}

test.describe("Network Trace", () => {
  // Training timer is 30s fixed — fail test needs to wait for expiry
  test.setTimeout(60_000);
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await skipOnboarding(page);
    await unlockMinigames(page, ["network-trace"]);
  });

  test("success — BFS pathfinding solves the maze", async ({ page }) => {
    await openTraining(page, "Network Trace", "TRIVIAL");

    // Wait for maze data element (hidden span — use toBeAttached, not toBeVisible)
    await expect(page.locator('[data-testid="maze-data"]')).toBeAttached({ timeout: 3000 });

    // Solve the maze using BFS on wall data
    const arrows = await solveMaze(page);
    expect(arrows.length).toBeGreaterThan(0);

    // Navigate step by step
    for (const arrow of arrows) {
      await page.keyboard.press(arrow);
      await page.waitForTimeout(50);
    }

    await expect(page.getByText("SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("fail — let timer expire without reaching end", async ({ page }) => {
    // Use INSANE difficulty for shortest timer
    await openTraining(page, "Network Trace", "INSANE");

    // Verify game started
    await expect(page.locator('[data-testid="player"]')).toBeVisible({ timeout: 5000 });

    // Do nothing — wait for timer to expire
    await expect(page.getByText("FAILED")).toBeVisible({ timeout: 45000 });
  });
});
