const BuildEngine = {
  WEIGHTS: {
    "gaming-1080p": { gpu: 0.36, cpu: 0.22, motherboard: 0.13, ram: 0.09, storage: 0.07, psu: 0.07, case: 0.06 },
    "gaming-1440p": { gpu: 0.42, cpu: 0.21, motherboard: 0.12, ram: 0.08, storage: 0.06, psu: 0.06, case: 0.05 },
    "gaming-4k":    { gpu: 0.46, cpu: 0.20, motherboard: 0.11, ram: 0.07, storage: 0.05, psu: 0.06, case: 0.05 },
    "creator":      { gpu: 0.32, cpu: 0.26, motherboard: 0.13, ram: 0.11, storage: 0.08, psu: 0.05, case: 0.05 },
    "office":       { gpu: 0.00, cpu: 0.34, motherboard: 0.22, ram: 0.16, storage: 0.12, psu: 0.08, case: 0.08 }
  },

  pickBestUnderBudget(list, maxPrice, filterFn = () => true, scoreKey = "gaming") {
    const valid = list.filter((item) => item.price <= maxPrice && filterFn(item));
    if (valid.length === 0) {
      const fallback = list.filter(filterFn);
      return fallback.sort((a, b) => a.price - b.price)[0] || list[0];
    }
    return valid.sort((a, b) => (b[scoreKey] || b.price) - (a[scoreKey] || a.price))[0];
  },

  generateBuild({ budget, workload, formFactor, noRgb, lockedParts = {} }) {
    const weights = this.WEIGHTS[workload] || this.WEIGHTS["gaming-1440p"];
    const scoreKey = workload === "creator" ? "creator" : "gaming";
    const rgbFilter = (item) => (!noRgb ? true : !item.rgb);

    const build = { ...lockedParts };

    // 1. GPU
    if (!build.gpu) {
      if (workload === "office") {
        build.gpu = PARTS_DB.gpu.find((g) => g.id === "gpu-0");
      } else {
        const gpuPool = PARTS_DB.gpu.filter((g) => g.price > 0 && rgbFilter(g));
        build.gpu = this.pickBestUnderBudget(gpuPool, budget * weights.gpu, () => true, scoreKey);
      }
    }

    // 2. CPU
    if (!build.cpu) {
      const mbSocket = build.motherboard ? build.motherboard.socket : null;
      build.cpu = this.pickBestUnderBudget(
        PARTS_DB.cpu,
        budget * weights.cpu,
        (c) => rgbFilter(c) && (!mbSocket || c.socket === mbSocket),
        scoreKey
      );
    }

    // 3. Motherboard (must match CPU socket and optional form factor)
    if (!build.motherboard) {
      build.motherboard = this.pickBestUnderBudget(
        PARTS_DB.motherboard,
        budget * weights.motherboard,
        (mb) =>
          rgbFilter(mb) &&
          mb.socket === build.cpu.socket &&
          (formFactor === "any" || mb.formFactor === formFactor),
        "price"
      );
    }

    // 4. RAM (must match Motherboard DDR type)
    if (!build.ram) {
      build.ram = this.pickBestUnderBudget(
        PARTS_DB.ram,
        budget * weights.ram,
        (r) => rgbFilter(r) && r.ramType === build.motherboard.ramType,
        scoreKey
      );
    }

    // 5. Storage
    if (!build.storage) {
      build.storage = this.pickBestUnderBudget(
        PARTS_DB.storage,
        budget * weights.storage,
        rgbFilter,
        scoreKey
      );
    }

    // 6. Case (must fit motherboard form factor & GPU length)
    if (!build.case) {
      build.case = this.pickBestUnderBudget(
        PARTS_DB.case,
        budget * weights.case,
        (c) =>
          rgbFilter(c) &&
          c.formFactors.includes(build.motherboard.formFactor) &&
          c.maxGpuLength >= build.gpu.length &&
          (formFactor === "any" ||
            (formFactor === "mATX" && c.formFactors.includes("mATX") && !c.formFactors.includes("ATX")) ||
            (formFactor === "ATX" && c.formFactors.includes("ATX"))),
        "price"
      );
    }

    // 7. PSU (must cover CPU + GPU + 100W with 25% headroom)
    if (!build.psu) {
      const requiredWatts = Math.ceil((build.cpu.tdp + build.gpu.tdp + 100) * 1.25);
      const validPsus = PARTS_DB.psu
        .filter((p) => rgbFilter(p) && p.wattage >= requiredWatts)
        .sort((a, b) => a.price - b.price);
      build.psu = validPsus[0] || PARTS_DB.psu[PARTS_DB.psu.length - 1];
    }

    // 8. Rebalance leftover budget into GPU or CPU upgrades if unlocked
    this.rebalanceBudget(build, budget, workload, noRgb, lockedParts);

    return build;
  },

  rebalanceBudget(build, budget, workload, noRgb, lockedParts) {
    const scoreKey = workload === "creator" ? "creator" : "gaming";
    const rgbFilter = (item) => (!noRgb ? true : !item.rgb);
    const getTotal = () => Object.values(build).reduce((sum, p) => sum + p.price, 0);

    // Try upgrading GPU first if not office and unlocked
    if (workload !== "office" && !lockedParts.gpu) {
      const currentWithoutGpu = getTotal() - build.gpu.price;
      const betterGpus = PARTS_DB.gpu
        .filter(
          (g) =>
            g.price > build.gpu.price &&
            currentWithoutGpu + g.price <= budget &&
            rgbFilter(g) &&
            g.length <= build.case.maxGpuLength &&
            Math.ceil((build.cpu.tdp + g.tdp + 100) * 1.25) <= build.psu.wattage
        )
        .sort((a, b) => b[scoreKey] - a[scoreKey]);

      if (betterGpus.length > 0) {
        build.gpu = betterGpus[0];
      }
    }

    // Next try upgrading CPU within the same socket if unlocked
    if (!lockedParts.cpu) {
      const currentWithoutCpu = getTotal() - build.cpu.price;
      const betterCpus = PARTS_DB.cpu
        .filter(
          (c) =>
            c.socket === build.motherboard.socket &&
            c.price > build.cpu.price &&
            currentWithoutCpu + c.price <= budget &&
            rgbFilter(c) &&
            Math.ceil((c.tdp + build.gpu.tdp + 100) * 1.25) <= build.psu.wattage
        )
        .sort((a, b) => b[scoreKey] - a[scoreKey]);

      if (betterCpus.length > 0) {
        build.cpu = betterCpus[0];
      }
    }
  },

  evaluateBuild(build, targetBudget) {
    const parts = Object.values(build);
    const totalPrice = parts.reduce((sum, p) => sum + p.price, 0);
    const estimatedLoad = build.cpu.tdp + build.gpu.tdp + 100;
    const recommendedPsu = Math.ceil(estimatedLoad * 1.25);
    const hasRgb = parts.some((p) => p.rgb);

    const issues = [];
    if (build.cpu.socket !== build.motherboard.socket) {
      issues.push(`Socket mismatch: ${build.cpu.socket} CPU vs ${build.motherboard.socket} board.`);
    }
    if (build.motherboard.ramType !== build.ram.ramType) {
      issues.push(`RAM mismatch: ${build.motherboard.ramType} board vs ${build.ram.ramType} memory.`);
    }
    if (!build.case.formFactors.includes(build.motherboard.formFactor)) {
      issues.push(`Case does not fit ${build.motherboard.formFactor} motherboard.`);
    }
    if (build.gpu.length > build.case.maxGpuLength) {
      issues.push(`GPU (${build.gpu.length}mm) exceeds case max (${build.case.maxGpuLength}mm).`);
    }
    if (build.psu.wattage < recommendedPsu) {
      issues.push(`PSU (${build.psu.wattage}W) below safe headroom (${recommendedPsu}W recommended).`);
    }
    if (totalPrice > targetBudget) {
      issues.push(`Over budget by £${totalPrice - targetBudget}.`);
    }

    const gamingScore = Math.min(
      100,
      Math.round(build.gpu.gaming * 0.62 + build.cpu.gaming * 0.28 + build.ram.gaming * 0.1)
    );
    const creatorScore = Math.min(
      100,
      Math.round(build.cpu.creator * 0.42 + build.gpu.creator * 0.38 + build.ram.creator * 0.2)
    );

    return {
      totalPrice,
      remaining: targetBudget - totalPrice,
      estimatedLoad,
      recommendedPsu,
      hasRgb,
      gamingScore,
      creatorScore,
      issues
    };
  },

  explainPart(category, part, build) {
    switch (category) {
      case "cpu":
        return `Matches ${build.motherboard.socket} socket with strong ${part.tdp}W thermal efficiency.`;
      case "motherboard":
        return `Supports ${part.socket} CPUs and ${part.ramType} memory in a ${part.formFactor} layout.`;
      case "gpu":
        return part.price === 0
          ? "Uses integrated CPU graphics to maximize budget for productivity."
          : `Delivers strong frame pacing within the ${build.case.maxGpuLength}mm case clearance.`;
      case "ram":
        return `${part.capacity}GB ${part.ramType} kit paired directly with the motherboard memory controller.`;
      case "storage":
        return `${part.capacity}GB NVMe solid-state storage for fast OS boot and game load times.`;
      case "psu":
        return `${part.wattage}W capacity provides safe headroom above the ${build.cpu.tdp + build.gpu.tdp + 100}W system load.`;
      case "case":
        return `Fits ${build.motherboard.formFactor} boards and GPUs up to ${part.maxGpuLength}mm.`;
      default:
        return "";
    }
  }
};
