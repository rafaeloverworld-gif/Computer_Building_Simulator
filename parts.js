const PARTS_DB = {
  cpu: [
    { id: "cpu-1", name: "AMD Ryzen 5 5600", price: 105, socket: "AM4", tdp: 65, gaming: 62, creator: 58, rgb: false, specs: "6 Cores / 12 Threads, up to 4.4 GHz" },
    { id: "cpu-2", name: "Intel Core i5-12400F", price: 115, socket: "LGA1700", tdp: 65, gaming: 64, creator: 60, rgb: false, specs: "6 Cores / 12 Threads, up to 4.4 GHz" },
    { id: "cpu-3", name: "AMD Ryzen 5 7600", price: 185, socket: "AM5", tdp: 65, gaming: 78, creator: 72, rgb: false, specs: "6 Cores / 12 Threads, up to 5.1 GHz, AM5" },
    { id: "cpu-4", name: "Intel Core i5-14600K", price: 245, socket: "LGA1700", tdp: 125, gaming: 84, creator: 85, rgb: false, specs: "14 Cores (6P+8E), up to 5.3 GHz" },
    { id: "cpu-5", name: "AMD Ryzen 7 7700X", price: 270, socket: "AM5", tdp: 105, gaming: 85, creator: 84, rgb: false, specs: "8 Cores / 16 Threads, up to 5.4 GHz, AM5" },
    { id: "cpu-6", name: "AMD Ryzen 7 9800X3D", price: 440, socket: "AM5", tdp: 120, gaming: 99, creator: 86, rgb: false, specs: "8 Cores / 16 Threads, 3D V-Cache Gaming Flagship" },
    { id: "cpu-7", name: "AMD Ryzen 9 9900X", price: 420, socket: "AM5", tdp: 120, gaming: 90, creator: 97, rgb: false, specs: "12 Cores / 24 Threads, up to 5.6 GHz" }
  ],
  motherboard: [
    { id: "mb-1", name: "MSI B550M PRO-VDH", price: 85, socket: "AM4", ramType: "DDR4", formFactor: "mATX", rgb: false, specs: "AM4, DDR4, Micro-ATX, Dual M.2" },
    { id: "mb-2", name: "Gigabyte B760M DS3H DDR4", price: 95, socket: "LGA1700", ramType: "DDR4", formFactor: "mATX", rgb: false, specs: "LGA1700, DDR4, Micro-ATX, PCIe 4.0" },
    { id: "mb-3", name: "MSI PRO B760-P WIFI DDR5", price: 145, socket: "LGA1700", ramType: "DDR5", formFactor: "ATX", rgb: false, specs: "LGA1700, DDR5, ATX, Wi-Fi 6E" },
    { id: "mb-4", name: "ASRock B650M Pro RS WiFi", price: 135, socket: "AM5", ramType: "DDR5", formFactor: "mATX", rgb: false, specs: "AM5, DDR5, Micro-ATX, Wi-Fi 6E" },
    { id: "mb-5", name: "MSI MAG B650 TOMAHAWK WIFI", price: 175, socket: "AM5", ramType: "DDR5", formFactor: "ATX", rgb: false, specs: "AM5, DDR5, Full ATX, Heavy VRM Heatsinks" },
    { id: "mb-6", name: "ASUS ROG STRIX X870-F GAMING", price: 295, socket: "AM5", ramType: "DDR5", formFactor: "ATX", rgb: true, specs: "AM5, DDR5, ATX, PCIe 5.0, RGB Lighting" }
  ],
  gpu: [
    { id: "gpu-0", name: "Integrated Graphics (No Discrete GPU)", price: 0, tdp: 0, length: 0, gaming: 15, creator: 20, rgb: false, specs: "Suitable for office, web, and coding tasks" },
    { id: "gpu-1", name: "AMD Radeon RX 6600 8GB", price: 195, tdp: 132, length: 240, gaming: 52, creator: 45, rgb: false, specs: "8GB GDDR6, Great 1080p Entry Value" },
    { id: "gpu-2", name: "NVIDIA GeForce RTX 4060 8GB", price: 275, tdp: 115, length: 245, gaming: 62, creator: 64, rgb: false, specs: "8GB GDDR6, DLSS 3, Efficient 1080p" },
    { id: "gpu-3", name: "AMD Radeon RX 7700 XT 12GB", price: 375, tdp: 245, length: 280, gaming: 76, creator: 68, rgb: false, specs: "12GB GDDR6, Strong 1440p Rasterization" },
    { id: "gpu-4", name: "NVIDIA GeForce RTX 4070 SUPER 12GB", price: 545, tdp: 220, length: 295, gaming: 86, creator: 88, rgb: false, specs: "12GB GDDR6X, 1440p Ray Tracing & CUDA" },
    { id: "gpu-5", name: "AMD Radeon RX 7900 XT 20GB", price: 650, tdp: 300, length: 315, gaming: 91, creator: 82, rgb: false, specs: "20GB GDDR6, High VRAM 1440p/4K" },
    { id: "gpu-6", name: "NVIDIA GeForce RTX 4080 SUPER 16GB", price: 940, tdp: 320, length: 335, gaming: 97, creator: 98, rgb: true, specs: "16GB GDDR6X, 4K Gaming & Heavy 3D Rendering" }
  ],
  ram: [
    { id: "ram-1", name: "Corsair Vengeance LPX 16GB (2x8GB) DDR4-3200", price: 38, ramType: "DDR4", capacity: 16, gaming: 58, creator: 52, rgb: false, specs: "16GB DDR4 3200MHz CL16 Low-Profile" },
    { id: "ram-2", name: "Kingston FURY Beast 32GB (2x16GB) DDR4-3600", price: 65, ramType: "DDR4", capacity: 32, gaming: 66, creator: 70, rgb: false, specs: "32GB DDR4 3600MHz CL18" },
    { id: "ram-3", name: "Crucial Pro 32GB (2x16GB) DDR5-6000", price: 92, ramType: "DDR5", capacity: 32, gaming: 85, creator: 84, rgb: false, specs: "32GB DDR5 6000MHz CL36 Stealth Black" },
    { id: "ram-4", name: "Corsair Vengeance RGB 32GB (2x16GB) DDR5-6000", price: 112, ramType: "DDR5", capacity: 32, gaming: 88, creator: 86, rgb: true, specs: "32GB DDR5 6000MHz CL30 with RGB" },
    { id: "ram-5", name: "G.Skill Flare X5 64GB (2x32GB) DDR5-6000", price: 185, ramType: "DDR5", capacity: 64, gaming: 90, creator: 98, rgb: false, specs: "64GB DDR5 6000MHz CL30 Workstation Kit" }
  ],
  storage: [
    { id: "ssd-1", name: "Kingston NV2 1TB NVMe Gen4 SSD", price: 54, capacity: 1000, gaming: 70, creator: 65, rgb: false, specs: "1TB M.2 PCIe 4.0, up to 3,500 MB/s" },
    { id: "ssd-2", name: "WD Black SN850X 1TB NVMe Gen4 SSD", price: 78, capacity: 1000, gaming: 85, creator: 84, rgb: false, specs: "1TB M.2 PCIe 4.0, up to 7,300 MB/s" },
    { id: "ssd-3", name: "Samsung 990 PRO 2TB NVMe Gen4 SSD", price: 145, capacity: 2000, gaming: 95, creator: 96, rgb: false, specs: "2TB M.2 PCIe 4.0, High Endurance & Speed" }
  ],
  psu: [
    { id: "psu-1", name: "MSI MAG A550BN 550W 80+ Bronze", price: 48, wattage: 550, rgb: false, specs: "550W 80+ Bronze, Non-Modular" },
    { id: "psu-2", name: "Corsair RM650 650W 80+ Gold", price: 79, wattage: 650, rgb: false, specs: "650W 80+ Gold, Fully Modular" },
    { id: "psu-3", name: "MSI MAG A750GL PCIe5 750W 80+ Gold", price: 95, wattage: 750, rgb: false, specs: "750W 80+ Gold, ATX 3.0 / 12VHPWR Ready" },
    { id: "psu-4", name: "Corsair RM850e 850W 80+ Gold", price: 118, wattage: 850, rgb: false, specs: "850W 80+ Gold, ATX 3.0, Quiet Fan" },
    { id: "psu-5", name: "be quiet! Pure Power 12 M 1000W", price: 149, wattage: 1000, rgb: false, specs: "1000W 80+ Gold, ATX 3.1 Dual Rail" }
  ],
  case: [
    { id: "case-1", name: "DeepCool MATREXX 40 Micro-ATX", price: 45, formFactors: ["mATX"], maxGpuLength: 320, rgb: false, specs: "Compact Micro-ATX Mesh, Max GPU 320mm" },
    { id: "case-2", name: "Montech AIR 100 ARGB Micro-ATX", price: 55, formFactors: ["mATX"], maxGpuLength: 330, rgb: true, specs: "Micro-ATX, 4x ARGB Fans Included" },
    { id: "case-3", name: "NZXT H5 Flow Mid-Tower ATX", price: 85, formFactors: ["ATX", "mATX"], maxGpuLength: 365, rgb: false, specs: "ATX / mATX, High Airflow Minimalist" },
    { id: "case-4", name: "Corsair 4000D Airflow ATX", price: 95, formFactors: ["ATX", "mATX"], maxGpuLength: 360, rgb: false, specs: "ATX / mATX, Clean Builder Favorite" },
    { id: "case-5", name: "Lian Li Lancool 216 RGB ATX", price: 109, formFactors: ["ATX", "mATX"], maxGpuLength: 392, rgb: true, specs: "ATX / mATX, Dual 160mm Front RGB Fans" }
  ]
};

const CLIENT_BRIEFS = [
  {
    name: "Alex Mercer",
    tag: "1440p Competitive Gamer",
    budget: 1350,
    workload: "gaming-1440p",
    noRgb: true,
    quote: "I want smooth 1440p gaming in shooters without any flashy RGB lights distracting me at night.",
    rules: [
      "Stay within £1,350 total budget",
      "Achieve a Gaming Score of at least 80",
      "Zero RGB components allowed",
      "100% compatible parts & safe PSU headroom"
    ],
    check: (build, stats) => stats.totalPrice <= 1350 && stats.gamingScore >= 80 && !stats.hasRgb && stats.issues.length === 0
  },
  {
    name: "Priya Nair",
    tag: "3D & Video Editor",
    budget: 1850,
    workload: "creator",
    noRgb: false,
    quote: "I edit 4K timelines in DaVinci Resolve and render Blender scenes. VRAM and RAM capacity matter most.",
    rules: [
      "Stay within £1,850 total budget",
      "Achieve a Creator Score of at least 86",
      "Include at least 32GB of RAM",
      "100% compatible parts & safe PSU headroom"
    ],
    check: (build, stats) => stats.totalPrice <= 1850 && stats.creatorScore >= 86 && build.ram.capacity >= 32 && stats.issues.length === 0
  },
  {
    name: "Samira Patel",
    tag: "Compact Student Rig",
    budget: 800,
    workload: "gaming-1080p",
    noRgb: false,
    quote: "My desk is tiny so I need a Micro-ATX PC for uni work and 1080p gaming under £800.",
    rules: [
      "Stay within £800 total budget",
      "Must use a Micro-ATX (mATX) case",
      "Achieve a Gaming Score of at least 55",
      "100% compatible parts & safe PSU headroom"
    ],
    check: (build, stats) => stats.totalPrice <= 800 && build.case.formFactors.includes("mATX") && !build.case.formFactors.includes("ATX") && stats.gamingScore >= 55 && stats.issues.length === 0
  }
];
