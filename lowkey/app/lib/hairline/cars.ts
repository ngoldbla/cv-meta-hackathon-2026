/**
 * Three Hairline car figures (sedan, SUV, pickup) in the package's
 * figure format (`FigureMount`), drawn with hairline-create and checked
 * with its validate/look tools. Concept (strongest rest pose wins):
 * Roller — the car rolls a little toward the pointer, wheels turning
 * with it; at rest the front wheel is bright. Range [0, 5, 10] is how
 * far it may roll. The tour was not judged (no reader to ask).
 *
 * `@lucasmarkes/hairline` 0.5.1 (MIT) publishes the 33 built-in figures
 * but does not export its mount/core for new figures, so these mounts
 * run on the same 0.5.1 core copied under `lib/hairline/core/` and are
 * mounted through the package's public `Figure`/`HairlineOptions`
 * contract. Themed with `--hairline-*` from Low Key's tokens.
 */
import type { Figure, HairlineOptions } from "@lucasmarkes/hairline";

import {
  Cam,
  clamp,
  facing,
  fit,
  hull,
  open,
  poly,
  prism,
  proj,
  ringAt,
  rings,
  run,
  seg,
  unproj,
  type Projector,
  type Ring,
} from "./core/iso";
import { spring, stepS } from "./core/motion";
import {
  disposer,
  mk,
  place,
  pointer,
  put,
  register,
  solid,
  type FigureMount,
} from "./core/stage";
import { inject } from "./core/styles";

export type CarKind = "sedan" | "suv" | "pickup";

interface CarSpec {
  label: string;
  bodyZ: [number, number];
  cabFoot: [number, number, number, number, number];
  cabTop: [number, number, number, number, number];
  cabZ: [number, number];
  bed: boolean;
  wheelR: number;
  wheelX: [number, number];
  topZ: number;
}

const SPECS: Record<CarKind, CarSpec> = {
  sedan: {
    label: "sedan",
    bodyZ: [12, 32],
    cabFoot: [36, 7, 84, 47, 8],
    cabTop: [42, 11, 74, 43, 7],
    cabZ: [32, 47],
    bed: false,
    wheelR: 12.5,
    wheelX: [30, 90],
    topZ: 50,
  },
  suv: {
    label: "suv",
    bodyZ: [12, 34],
    cabFoot: [28, 5, 97, 49, 7],
    cabTop: [32, 8, 94, 46, 6],
    cabZ: [34, 56],
    bed: false,
    wheelR: 13.5,
    wheelX: [30, 92],
    topZ: 58,
  },
  pickup: {
    label: "pickup",
    bodyZ: [12, 32],
    cabFoot: [60, 6, 94, 48, 7],
    cabTop: [64, 10, 91, 44, 6],
    cabZ: [32, 52],
    bed: true,
    wheelR: 13.5,
    wheelX: [30, 92],
    topZ: 54,
  },
};

function tapered(
  Q: Projector,
  front: (q: Ring[number]) => boolean,
  foot: Ring,
  top: [Ring, Ring],
  z0: number,
  z1: number,
) {
  return {
    sil: poly(hull(ringAt(Q, foot, z0).concat(ringAt(Q, top[0], z1)))),
    crease: open(ringAt(Q, run(top[1], front), z1)),
  };
}

function makeCarMount(spec: CarSpec): FigureMount {
  return ({ stage, svg, read }, value) => {
    const bag = disposer();
    let reach = value;
    let over: [number, number] | null = null;
    let hover = false;

    const C = Cam(45, 0.5, 2.15);
    fit(C, [[-12, -4, 0], [132, 58, 0], [0, 0, spec.topZ], [120, 54, spec.topZ]], 200, 166);
    const P = proj(C);
    const front = facing(C);
    const WR = spec.wheelR;
    const WX = spec.wheelX;

    const g = mk("g", {}, svg);
    const farW = WX.map(() => mk("path", { class: "lo" }, g));
    const body = solid(g);
    const bed = spec.bed ? solid(g) : null;
    const cab = solid(g);
    const nearW = WX.map(() => mk("path", { class: "sil" }, g));
    const spokes = WX.map(() => mk("path", { class: "nf" }, g));
    const hubs = WX.map(() => mk("circle", { r: 3, class: "dot m" }, g));

    const [bodyRing, bodyInner] = rings(2, 2, 118, 52, 10, 1.4);
    const [bedRing, bedInner] = rings(4, 4, 56, 50, 6, 1);
    const [cabFoot] = rings(...spec.cabFoot, 1.2);
    const cabTop = rings(...spec.cabTop, 1.2);

    const rollS = spring(0);
    const angS = spring(0);
    let drawn = NaN;

    function wheel(Q: Projector, cx: number, y: number, a: number) {
      const pts: [number, number][] = [];
      for (let k = 0; k < 16; k += 1) {
        const t = (k / 16) * Math.PI * 2;
        pts.push(Q(cx + WR * Math.cos(t), y, WR + WR * Math.sin(t)));
      }
      return {
        d: poly(pts),
        spoke: seg(Q(cx, y, WR), Q(cx + WR * Math.cos(a), y, WR + WR * Math.sin(a))),
        hub: Q(cx, y, WR),
      };
    }

    function draw(roll: number, ang: number) {
      if (drawn === roll) return;
      drawn = roll;
      const Q: Projector = (x, y, z) => P(x + roll, y, z);
      WX.forEach((cx, i) => {
        farW[i]?.setAttribute("d", wheel(Q, cx, -1.5, ang).d);
        const w = wheel(Q, cx, 55.5, ang);
        nearW[i]?.setAttribute("d", w.d);
        spokes[i]?.setAttribute("d", w.spoke);
        const hub = hubs[i];
        if (hub) place(hub, w.hub);
      });
      put(body, prism(Q, front, bodyRing, bodyInner, spec.bodyZ[0], spec.bodyZ[1]));
      if (bed) put(bed, prism(Q, front, bedRing, bedInner, 32, 39));
      put(cab, tapered(Q, front, cabFoot, cabTop, spec.cabZ[0], spec.cabZ[1]));
      nearW[1]?.classList.toggle("hi", !hover);
      body.sil.classList.toggle("hi", hover);
    }

    function setHover(next: boolean) {
      if (next === hover) return;
      hover = next;
      read.textContent = hover ? spec.label : "rest";
      nearW[1]?.classList.toggle("hi", !hover);
      body.sil.classList.toggle("hi", hover);
    }

    function retarget() {
      if (over) {
        rollS.t = clamp((over[0] - 60) * 0.3, -reach, reach);
      } else {
        rollS.t = 0;
        setHover(false);
      }
      angS.t = rollS.t / WR;
      B.wake();
    }

    const B = register(stage, (dt) => {
      const moving = stepS(rollS, dt) || stepS(angS, dt);
      draw(rollS.x, angS.x);
      return moving;
    });
    bag.add(B.unregister);
    draw(0, 0);
    read.textContent = "rest";

    bag.add(
      pointer(stage, {
        move: (p) => {
          over = unproj(C, p[0], p[1], 0);
          const top = unproj(C, p[0], p[1], spec.bodyZ[1]);
          const inFoot = (q: [number, number]) =>
            q[0] > -10 && q[0] < 130 && q[1] > -10 && q[1] < 64;
          setHover(inFoot(over) || inFoot(top));
          retarget();
        },
        leave: () => {
          over = null;
          retarget();
        },
      }),
    );
    bag.add(() => svg.replaceChildren());

    return {
      set: (v) => {
        reach = v;
        retarget();
      },
      destroy: bag.dispose,
    };
  };
}

export const CAR_LABELS: Record<CarKind, string> = {
  sedan: "Isometric line drawing of a sedan that rolls a little toward the pointer.",
  suv: "Isometric line drawing of an SUV that rolls a little toward the pointer.",
  pickup: "Isometric line drawing of a pickup that rolls a little toward the pointer.",
};

/** Mount a car figure on `el` (package `Figure` contract; never plays). */
export function mountCar(
  el: HTMLElement,
  kind: CarKind,
  options?: HairlineOptions,
): Figure {
  const opts: HairlineOptions = { ...options };
  const spec = SPECS[kind];
  inject(el.ownerDocument);
  el.setAttribute("data-hairline", kind);
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", opts.label ?? CAR_LABELS[kind]);

  const svg = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 400 320");
  svg.setAttribute("aria-hidden", "true");
  el.appendChild(svg);

  let text: string | null = null;
  const read = {
    get textContent() {
      return text;
    },
    set textContent(value: string | null) {
      const next = value ?? "";
      if (next === text) return;
      text = next;
      if (typeof opts.onRead === "function") opts.onRead(next);
    },
  };

  const reachOf = () => {
    const i = typeof opts.intensity === "number" ? clamp(opts.intensity, 0, 1) : 0.5;
    return i * 10;
  };
  const engine = makeCarMount(spec)({ stage: el, svg, read }, reachOf());
  if (text === null) read.textContent = "rest";

  let dead = false;
  return {
    update(next) {
      if (dead || !next) return;
      const given = next as Record<string, unknown>;
      const own = opts as Record<string, unknown>;
      for (const k in given) {
        if (given[k] === undefined) delete own[k];
        else own[k] = given[k];
      }
      if ("intensity" in given) engine.set(reachOf());
      if (typeof opts.label === "string") el.setAttribute("aria-label", opts.label);
    },
    destroy() {
      if (dead) return;
      dead = true;
      engine.destroy();
      svg.remove();
      el.removeAttribute("data-hairline");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
    },
  };
}
