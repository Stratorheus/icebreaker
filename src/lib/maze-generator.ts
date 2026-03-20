/**
 * Recursive backtracking maze generator — edge-based walls.
 *
 * Each cell stores which edges (N/S/E/W) have walls. Walls are rendered
 * as CSS borders rather than full-cell blocks.
 */

export interface CellWalls {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

export interface MazeData {
  /** rows x cols grid of wall data per cell */
  cells: CellWalls[][];
  rows: number;
  cols: number;
  /** [row, col] in logical cell coordinates */
  start: [number, number];
  /** [row, col] in logical cell coordinates */
  end: [number, number];
}

/**
 * Generate a perfect maze with the given logical cell dimensions.
 * Uses recursive backtracking (iterative stack) to carve passages.
 *
 * @param rows - Number of cell rows
 * @param cols - Number of cell columns
 */
export function generateMaze(rows: number, cols: number): MazeData {
  // Initialize: all walls present
  const cells: CellWalls[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      north: true,
      south: true,
      east: true,
      west: true,
    })),
  );

  // Track visited cells
  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false) as boolean[],
  );

  // Directions: [dRow, dCol]
  const directions: [number, number][] = [
    [-1, 0], // up (north)
    [1, 0],  // down (south)
    [0, -1], // left (west)
    [0, 1],  // right (east)
  ];

  function shuffleDirections(): [number, number][] {
    const arr = [...directions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Remove the wall between two adjacent cells
  function removeWall(r1: number, c1: number, r2: number, c2: number) {
    const dr = r2 - r1;
    const dc = c2 - c1;

    if (dr === -1) {
      // Moving north: remove north wall of current, south wall of neighbor
      cells[r1][c1].north = false;
      cells[r2][c2].south = false;
    } else if (dr === 1) {
      // Moving south
      cells[r1][c1].south = false;
      cells[r2][c2].north = false;
    } else if (dc === -1) {
      // Moving west
      cells[r1][c1].west = false;
      cells[r2][c2].east = false;
    } else if (dc === 1) {
      // Moving east
      cells[r1][c1].east = false;
      cells[r2][c2].west = false;
    }
  }

  // Iterative recursive backtracking
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const dirs = shuffleDirections();
    let carved = false;

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;

      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        visited[nr][nc] = true;
        removeWall(cr, cc, nr, nc);
        stack.push([nr, nc]);
        carved = true;
        break;
      }
    }

    if (!carved) {
      stack.pop();
    }
  }

  return {
    cells,
    rows,
    cols,
    start: [0, 0],
    end: [rows - 1, cols - 1],
  };
}
