/**
 * FrameFlow — Cinematic Architectural Scroll Website
 * Technology: Vanilla JavaScript, HTML5 Canvas, requestAnimationFrame
 * Optimized for 60fps frame interpolation, DPR scaling, & progressive loading
 */

// ==========================================================================
// 1. CONFIGURATION
// ==========================================================================
const CONFIG = {
  // Frame Sequence Settings
  frameFolder: "./frames/",
  frameCount: 400,
  frameName: (index) => `frame_${String(index).padStart(4, "0")}.jpg`,

  // Progressive Loading Settings
  firstBatch: 30,

  // Scroll Container Height (in vh units)
  scrollHeight: 600,

  // Smooth Inertia Interpolation Factor (0.08 default)
  lerp: 0.08,

  // Section Configurations
  sections: [
    {
      id: "hall",
      start: 1,
      end: 110,
      name: "Hall",
      counter: "01 / 04  HALL",
      title: "A measured entrance",
      description: "The hall establishes the rhythm, scale, and first impression of the journey.",
      position: "right"
    },
    {
      id: "room",
      start: 111,
      end: 220,
      name: "Room",
      counter: "02 / 04  ROOM",
      title: "Space to settle",
      description: "The room opens the sequence into a quieter, more intimate layer of the interior.",
      position: "left"
    },
    {
      id: "kitchen",
      start: 221,
      end: 320,
      name: "Kitchen",
      counter: "03 / 04  KITCHEN",
      title: "The final detail",
      description: "The kitchen closes the journey with material, light, and practical detail.",
      position: "right"
    },
    {
      id: "developer",
      start: 321,
      end: 400,
      name: "Creator",
      counter: "04 / 04  CREATOR",
      title: "Salman",
      description: "Crafted with high-performance HTML5 Canvas rendering, physics-based scroll interpolation, and modern architectural minimalism.",
      position: "left"
    }
  ]
};

// ==========================================================================
// 2. STATE & CACHE
// ==========================================================================
const frames = new Array(CONFIG.frameCount + 1);
const loadedIndices = new Set();

let targetFrame = 1;
let currentFrame = 1;
let lastRenderedFrame = -1;

let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let maxScroll = 0;
let currentScrollY = window.scrollY;

let activeSectionId = null;
let isInitialLoaded = false;

// DOM Elements
const canvas = document.getElementById("sequence-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const loadingScreen = document.getElementById("loading-screen");
const loaderBar = document.getElementById("loader-bar");
const loaderPercent = document.getElementById("loader-percent");
const loaderStatus = document.getElementById("loader-status");
const errorScreen = document.getElementById("error-screen");
const scrollTrack = document.getElementById("scroll-track");
const scrollHint = document.getElementById("scroll-hint");
const hudFrameNum = document.getElementById("hud-frame-num");
const navList = document.getElementById("nav-list");
const sectionCards = document.querySelectorAll(".section-card");

// ==========================================================================
// 3. UTILITIES & HELPERS
// ==========================================================================
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fallback search for closest loaded frame (Requirement 9)
function findClosestLoadedFrame(targetIndex) {
  if (frames[targetIndex] && frames[targetIndex].naturalWidth > 0) {
    return frames[targetIndex];
  }

  // 1. Search backward
  for (let i = targetIndex - 1; i >= 1; i--) {
    if (frames[i] && frames[i].naturalWidth > 0) {
      return frames[i];
    }
  }

  // 2. Search forward
  for (let i = targetIndex + 1; i <= CONFIG.frameCount; i++) {
    if (frames[i] && frames[i].naturalWidth > 0) {
      return frames[i];
    }
  }

  return null;
}

// ==========================================================================
// 4. CANVAS RENDERING & DPR HANDLING (Requirements 2, 3, 23)
// ==========================================================================
function updateDimensions() {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  maxScroll = document.documentElement.scrollHeight - window.innerHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;

  // Scale context so drawing coordinates remain 1:1 with viewport
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Force redraw on next tick
  lastRenderedFrame = -1;
  drawFrame(Math.round(currentFrame));
}

function drawFrame(index) {
  const image = frames[index] || findClosestLoadedFrame(index);

  if (!image || !image.naturalWidth) {
    return;
  }

  // Cover Fit calculation: Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight)
  const scale = Math.max(
    viewportWidth / image.naturalWidth,
    viewportHeight / image.naturalHeight
  );

  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  const x = (viewportWidth - width) / 2;
  const y = (viewportHeight - height) / 2;

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.drawImage(image, x, y, width, height);
}

// ==========================================================================
// 5. PROGRESSIVE FRAME LOADING (Requirements 4, 5, 21)
// ==========================================================================
function loadSingleFrame(index) {
  if (frames[index]) return Promise.resolve(frames[index]);

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";

    img.onload = async () => {
      if (typeof img.decode === "function") {
        try {
          await img.decode();
        } catch (_) {
          // Graceful fallback if decode is cancelled
        }
      }
      frames[index] = img;
      loadedIndices.add(index);
      resolve(img);
    };

    img.onerror = () => {
      // Handled gracefully without console crashes
      resolve(null);
    };

    img.src = `${CONFIG.frameFolder}${CONFIG.frameName(index)}`;
  });
}

function updateLoadingProgress(percent) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  loaderBar.style.width = `${clamped}%`;
  loaderPercent.textContent = `${clamped}%`;
}

function showErrorScreen() {
  loadingScreen.classList.add("is-loaded");
  errorScreen.classList.remove("hidden");
}

async function loadInitialBatch() {
  const batchCount = Math.min(CONFIG.firstBatch, CONFIG.frameCount);
  let batchLoadedCount = 0;

  const initialPromises = [];

  for (let i = 1; i <= batchCount; i++) {
    const promise = loadSingleFrame(i).then((img) => {
      if (img) {
        batchLoadedCount++;
        const percent = Math.round((batchLoadedCount / batchCount) * 100);
        updateLoadingProgress(percent);
      }
      return img;
    });
    initialPromises.push(promise);
  }

  const results = await Promise.all(initialPromises);
  const successfulLoads = results.filter(Boolean).length;

  if (successfulLoads === 0) {
    showErrorScreen();
    return false;
  }

  isInitialLoaded = true;
  updateLoadingProgress(100);

  // Render initial frame
  drawFrame(1);
  lastRenderedFrame = 1;
  updateActiveSection(1);
  updateHUD(1);

  // Smoothly fade out loading screen
  setTimeout(() => {
    loadingScreen.classList.add("is-loaded");
  }, 400);

  // Continue progressive loading in background with concurrency pool
  loadRemainingFramesBackground(batchCount + 1);

  return true;
}

async function loadRemainingFramesBackground(startIndex) {
  const concurrency = 6;
  let nextIndex = startIndex;

  async function worker() {
    while (nextIndex <= CONFIG.frameCount) {
      const idx = nextIndex++;
      await loadSingleFrame(idx);
    }
  }

  const pool = [];
  for (let i = 0; i < concurrency; i++) {
    pool.push(worker());
  }

  await Promise.all(pool);
}

// ==========================================================================
// 6. SCROLL & SECTION INTERACTION (Requirements 6, 7, 8, 10, 11, 12, 13, 17, 18)
// ==========================================================================
function onScroll() {
  currentScrollY = window.scrollY;
  const progress = maxScroll > 0 ? Math.min(Math.max(currentScrollY / maxScroll, 0), 1) : 0;

  // Map progress (0 -> 1) to frames (1 -> 400)
  targetFrame = 1 + progress * (CONFIG.frameCount - 1);

  // Dismiss scroll hint when scrolled
  if (progress > 0.015) {
    scrollHint.classList.add("is-scrolled");
  } else {
    scrollHint.classList.remove("is-scrolled");
  }
}

function updateActiveSection(frameNum) {
  // Find which section corresponds to the frame
  let currentSec = null;

  for (const sec of CONFIG.sections) {
    if (frameNum >= sec.start && frameNum <= sec.end) {
      currentSec = sec;
      break;
    }
  }

  if (currentSec && currentSec.id !== activeSectionId) {
    activeSectionId = currentSec.id;

    // Update section cards (CSS transitions handle elegant overlap and slide/blur)
    sectionCards.forEach((card) => {
      const cardSecId = card.getAttribute("data-section-id");
      if (cardSecId === currentSec.id) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });

    // Update Navigation Rail active dot
    const navItems = navList.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      if (item.getAttribute("data-section-id") === currentSec.id) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }
}

function updateHUD(frameNum) {
  if (hudFrameNum) {
    const formatted = `FRAME ${String(frameNum).padStart(4, "0")} / ${String(CONFIG.frameCount).padStart(4, "0")}`;
    hudFrameNum.textContent = formatted;
  }
}

function initNavigation() {
  navList.innerHTML = "";

  CONFIG.sections.forEach((sec, index) => {
    const li = document.createElement("li");
    li.className = `nav-item ${index === 0 ? "active" : ""}`;
    li.setAttribute("data-section-id", sec.id);

    const btn = document.createElement("button");
    btn.className = "nav-dot-btn";
    btn.setAttribute("aria-label", `Scroll to ${sec.name}`);
    btn.innerHTML = `<span class="nav-dot-circle"></span>`;

    btn.addEventListener("click", () => {
      navigateToSection(sec);
    });

    const label = document.createElement("span");
    label.className = "nav-label";
    label.textContent = sec.name;

    li.appendChild(btn);
    li.appendChild(label);
    navList.appendChild(li);
  });
}

function navigateToSection(sec) {
  const isReduced = prefersReducedMotion();
  const scrollProgress = (sec.start - 1) / (CONFIG.frameCount - 1);
  const targetScroll = scrollProgress * maxScroll;

  window.scrollTo({
    top: targetScroll,
    behavior: isReduced ? "auto" : "smooth"
  });
}

// ==========================================================================
// 7. ANIMATION LOOP (requestAnimationFrame)
// ==========================================================================
function animationLoop() {
  if (prefersReducedMotion()) {
    currentFrame = targetFrame;
  } else {
    currentFrame = lerp(currentFrame, targetFrame, CONFIG.lerp);

    if (Math.abs(targetFrame - currentFrame) < 0.001) {
      currentFrame = targetFrame;
    }
  }

  const roundedFrame = Math.round(currentFrame);

  // Redraw optimization: ONLY redraw when rounded frame changes
  if (roundedFrame !== lastRenderedFrame) {
    drawFrame(roundedFrame);
    lastRenderedFrame = roundedFrame;
    updateActiveSection(roundedFrame);
    updateHUD(roundedFrame);
  }

  requestAnimationFrame(animationLoop);
}

// ==========================================================================
// 8. INITIALIZATION & EVENT LISTENERS
// ==========================================================================
function init() {
  // Apply dynamic scroll height
  scrollTrack.style.height = `${CONFIG.scrollHeight}vh`;

  initNavigation();
  updateDimensions();

  // Passive event listener for high performance scroll tracking
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateDimensions, { passive: true });

  // Handle Brand Logo click to scroll to top
  const brandLogo = document.querySelector(".brand-logo");
  if (brandLogo) {
    brandLogo.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
    });
  }

  // Handle Replay Journey button click
  const restartBtn = document.getElementById("restart-journey-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
    });
  }

  // Start Animation Loop
  requestAnimationFrame(animationLoop);

  // Kickoff progressive batch loading
  loadInitialBatch();
}

// Start on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
