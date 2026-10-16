import { useId } from "react";
import { cn } from "../lib/cn";

/**
 * Kente band.
 *
 * An original geometric homage to Asante kente, not a reproduction of any
 * named cloth. Kente is woven in narrow strips on a horizontal loom and then
 * sewn edge to edge, so the structure here follows the real thing: alternating
 * warp-faced blocks (stripes running along the strip) and weft-faced blocks
 * (stripes running across it), separated by the dark seam where two strips
 * meet. Four blocks per repeat rather than two, so it reads as cloth instead
 * of as wallpaper.
 *
 * Colours follow the traditional associations — gold for status, green for
 * growth and harvest, black for the ancestors, red for the strength of strong
 * feeling — with the brand cobalt woven into one block to tie it to Siesie.
 *
 * Purely decorative: it is aria-hidden, and it is never placed next to an
 * amount, because gold, green and red are how this product says held,
 * released and disputed.
 */

const GOLD = "#dfa41c";
const BLACK = "#17130e";
const GREEN = "#12704a";
const RED = "#a81e14";
const BLUE = "#1e40af";

const BLOCK = 46; // one woven strip
const SEAM = 2; // the dark join between strips
const H = 56; // band height in pattern units
const TILE = (BLOCK + SEAM) * 4;

/** [offset, length, colour] along the block's striped axis. */
type Stripe = [number, number, string];

const WARP_A: Stripe[] = [
  [0, 3, GOLD], [3, 3, BLACK], [6, 3, GOLD], [9, 5, GREEN], [14, 3, GOLD],
  [17, 3, BLACK], [20, 6, GOLD], [26, 3, BLACK], [29, 3, GOLD], [32, 5, GREEN],
  [37, 3, GOLD], [40, 3, BLACK], [43, 3, GOLD],
];

const WEFT_A: Stripe[] = [
  [0, 6, RED], [6, 3, GOLD], [9, 8, BLACK], [17, 3, GOLD], [20, 8, RED],
  [28, 3, GOLD], [31, 8, BLACK], [39, 3, GOLD], [42, 8, RED], [50, 6, GOLD],
];

const WARP_B: Stripe[] = [
  [0, 3, GREEN], [3, 3, GOLD], [6, 3, BLUE], [9, 5, GOLD], [14, 3, BLUE],
  [17, 3, GOLD], [20, 6, GREEN], [26, 3, GOLD], [29, 3, BLUE], [32, 5, GOLD],
  [37, 3, BLUE], [40, 3, GOLD], [43, 3, GREEN],
];

const WEFT_B: Stripe[] = [
  [0, 6, BLACK], [6, 3, GOLD], [9, 8, GREEN], [17, 3, GOLD], [20, 8, BLACK],
  [28, 3, GOLD], [31, 8, GREEN], [39, 3, GOLD], [42, 8, BLACK], [50, 6, GOLD],
];

const BLOCKS: Array<{ stripes: Stripe[]; warp: boolean }> = [
  { stripes: WARP_A, warp: true },
  { stripes: WEFT_A, warp: false },
  { stripes: WARP_B, warp: true },
  { stripes: WEFT_B, warp: false },
];

export function KenteBand({ className, vertical }: { className?: string; vertical?: boolean }) {
  const id = useId().replace(/:/g, "");
  const patternId = `kente-${id}`;

  return (
    // No viewBox on purpose: one user unit stays one CSS pixel, so the weave
    // keeps its real size and repeats across the width instead of stretching.
    <svg className={cn("block", className)} aria-hidden focusable="false">
      <defs>
        {/* userSpaceOnUse keeps the weave at a fixed size, so the band repeats
            across any width instead of stretching to fit it. */}
        {/* The tile box always stays TILE x H and holds the same weave; the
            vertical variant only rotates the pattern's coordinate system.
            Swapping width/height here instead would crop the tile. */}
        <pattern id={patternId} width={TILE} height={H} patternUnits="userSpaceOnUse" patternTransform={vertical ? "rotate(90)" : undefined}>
          {/* The seam colour shows through between blocks. */}
          <rect width={TILE} height={H} fill={BLACK} />
          {BLOCKS.map((block, i) => {
            const offset = i * (BLOCK + SEAM);
            return block.stripes.map(([start, len, fill], j) =>
              block.warp ? (
                // Warp-faced: stripes run along the strip.
                <rect key={`${i}-${j}`} x={offset + start} y={0} width={len} height={H} fill={fill} />
              ) : (
                // Weft-faced: stripes run across it.
                <rect key={`${i}-${j}`} x={offset} y={start} width={BLOCK} height={len} fill={fill} />
              ),
            );
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
