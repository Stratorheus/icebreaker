/**
 * Recursive backtracking maze generator.
 *
 * Generates a perfect maze (exactly one path between any two cells).
 * Grid uses the standard "wall grid" encoding:
 *   - Size: (2*rows+1) x (2*cols+1)
 *   - Cells are at odd coordinates: (1,1), (1,3), (3,1), (3,3), ...
 *   - Walls occupy even rows/cols; passages are carved by setting wall cells to false.
 */

export interface MazeData {
  /** true = wall, false = path. Size: (2*rows+1) x (2*cols+1) */
  grid: boolean[][];
  /** [row, col] in grid coordinates */
  start: [number, number];
  /** [row, col] in grid coordinates */
  end: [number, number];
}

/**
 * Generate a maze with the given logical cell dimensions.
 *
 * @param rows - Number of cell rows (e.g. 5 gives an 11x11 grid)
 * @param cols - Number of cell columns
 */
export function generateMaze(rows: number, cols: number): MazeData {
  const gridRows = 2 * rows + 1;
  const gridCols = 2 * cols + 1;

  // Initialize grid: all walls (true)
  const grid: boolean[][] = Array.from({ length: gridRows }, () =>
    Array(gridCols).fill(true) as boolean[],
  );

  // Track visited cells (logical coordinates)
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false) as boolean[],
  );

  // Directions: [dRow, dCol] in logical cell space
  const directions: [number, number][] = [
    [-1, 0], // up
    [1, 0],  // down
    [0, -1], // left
    [0, 1],  // right
  ];

  // Fisher-Yates shuffle for direction randomization
  function shuffleDirections(): [number, number][] {
    const arr = [...directions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Convert logical cell (r, c) to grid coordinates
  function cellToGrid(r: number, c: number): [number, number] {
    return [2 * r + 1, 2 * c + 1];
  }

  // Recursive backtracking using an explicit stack to avoid call stack overflow
  // on large mazes
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  const [startGR, startGC] = cellToGrid(0, 0);
  grid[startGR][startGC] = false; // carve start cell

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const dirs = shuffleDirections();
    let carved = false;

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;

      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        visited[nr][nc] = true;

        // Carve the neighbor cell
        const [ngr, ngc] = cellToGrid(nr, nc);
        grid[ngr][ngc] = false;

        // Carve the wall between current cell and neighbor
        const wallGR = 2 * cr + 1 + dr;
        const wallGC = 2 * cc + 1 + dc;
        grid[wallGR][wallGC] = false;

        stack.push([nr, nc]);
        carved = true;
        break; // restart from the new cell
      }
    }

    if (!carved) {
      stack.pop(); // backtrack
    }
  }

  const start: [number, number] = cellToGrid(0, 0);
  const end: [number, number] = cellToGrid(rows - 1, cols - 1);

  return { grid, start, end };
}
