// Curated examples, verified 2026-10-16. Abstract attribution and licenses are retained in notes.
const examples = [
  {
    "id": "sample-arxiv-2607-22094",
    "title": "Transforming Keystroke Noise to Text: Self-Supervised Acoustic Eavesdropping Attacks on Keyboards",
    "authors": "Atsunori Okada; Akira Ito; Rei Ueno; Yuichi Hayashi; Naofumi Homma",
    "year": 2026,
    "venue": "arXiv",
    "doi": "10.48550/arXiv.2607.22094",
    "url": "https://doi.org/10.48550/arXiv.2607.22094",
    "tags": [
      "Side-channel analysis/Acoustic",
      "Machine learning/Self-supervised learning"
    ],
    "metadataSource": "arXiv",
    "type": "posted-content"
  },
  {
    "id": "sample-tches-2026-qr-uov",
    "title": "AVX2 Implementation of QR-UOV for Modern x86 Processors",
    "authors": "Hiroshi Amagasa; Rei Ueno; Naofumi Homma",
    "year": 2026,
    "venue": "IACR TCHES",
    "doi": "10.46586/tches.v2026.i2.325-346",
    "url": "https://doi.org/10.46586/tches.v2026.i2.325-346",
    "tags": [
      "PQC/QR-UOV",
      "Implementations/Software"
    ],
    "abstract": "QR-UOV is a multivariate signature scheme selected as one of the candidates in the second round of the NIST PQC Additional Digital Signatures process. This paper presents software acceleration methods for QR-UOV optimized for modern x86 architectures. QR-UOV operates over small odd prime-power extension fields such as GF(313) and GF(1273) unlike other multivariate signature candidates. This property allows direct utilization of hardware multipliers for field arithmetic, offering a distinctive advantage for high-performance implementations. Yet, how to implement QR-UOV efficiently on modern CPUs based on the property remains unclear so far. Our implementation benefits from two proposed ideas: (1) reducing the computational overhead of the QR-UOV algorithm through algorithm-level optimization, and (2) leveraging advanced SIMD instruction set extensions (e.g., AVX2, AVX-512) to accelerate main operations such as matrix multiplication. Our implementation achieves substantial speedups over the Round 2 reference: for the parameter set (q, ℓ) = (127, 3) at NIST security level I, it delivers a 5.1x improvement in key generation, 3.6x in signature generation, and 5.7x in signature verification. These results demonstrate that QR-UOV achieves performance comparable or higher than that of UOV implementations, particularly at higher security levels.",
    "metadataSource": "Crossref",
    "type": "journal-article",
    "notes": "Abstract by Hiroshi Amagasa, Rei Ueno, and Naofumi Homma. Source: https://doi.org/10.46586/tches.v2026.i2.325-346. Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. No changes to abstract text."
  },
  {
    "id": "sample-eprint-2026-1458",
    "title": "A High-Speed Hardware Accelerator for QR-UOV Signature Scheme",
    "authors": "Renma Sugai; Hiroshi Amagasa; Rei Ueno; Naofumi Homma",
    "year": 2026,
    "venue": "IACR Cryptology ePrint Archive",
    "doi": "",
    "url": "https://eprint.iacr.org/2026/1458",
    "tags": [
      "PQC/QR-UOV",
      "Implementations/Hardware"
    ],
    "abstract": "This paper proposes a high-speed hardware accelerator for QR-UOV, a multivariate scheme, that executes all three operations: key generation, signature generation, and signature verification.\nQR-UOV utilizes a quotient polynomial ring structure to reduce the public-key size of the original UOV scheme; however, this introduces functional requirements distinct from other multivariate schemes, such as polynomial-matrix operations over $\\mathbb{F}_{q^\\ell}$, coefficient expansion for the Mersenne prime field $\\mathbb{F}_{q}$, and the expansion of symmetric matrices generated in a compressed form.\nTo accelerate polynomial-matrix multiplication over $\\mathbb{F}_{q^\\ell}$, the proposed architecture employs a $D \\times D$ systolic array ($D$ is the parallelization factor), in which each PE internally contains a polynomial multiply-accumulate unit.\nFor signature verification, the architecture also incorporates a quadratic-form operation unit without explicitly storing the intermediate vector--matrix products.\nIn addition, to ensure a regular data supply from key expansion to matrix operations, the architecture incorporates on-the-fly rejection sampling, which exploits the property that AES-CTR output blocks can be generated independently, as well as an expansion process for the symmetric matrices in compressed form.\nFurthermore, the architecture enables pipelined processing, overlapping the $i$-th polynomial-matrix operation with the $(i+1)$-th public-key expansion.\nFPGA evaluation shows that the proposed hardware executes key generation, signature generation, and signature verification in 0.74 ms, 0.28 ms, and 0.19 ms, respectively, at security level I.\nFurthermore, we confirm that the proposed hardware exhibits a lower LUT-time product than that of existing UOV hardware.",
    "metadataSource": "IACR ePrint",
    "type": "posted-content",
    "notes": "Abstract by Renma Sugai, Hiroshi Amagasa, Rei Ueno, and Naofumi Homma. Source: https://eprint.iacr.org/2026/1458. Licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. No changes to abstract text."
  },
  {
    "id": "sample-ccs-2022-masking",
    "title": "On the Success Rate of Side-Channel Attacks on Masked Implementations: Information-Theoretical Bounds and Their Practical Usage",
    "authors": "Akira Ito; Rei Ueno; Naofumi Homma",
    "year": 2022,
    "venue": "ACM CCS",
    "doi": "10.1145/3548606.3560579",
    "url": "https://doi.org/10.1145/3548606.3560579",
    "tags": [
      "Side-channel analysis/Masking",
      "Theory/Information theory"
    ],
    "metadataSource": "Crossref",
    "type": "proceedings-article"
  },
  {
    "id": "sample-eprint-2021-849",
    "title": "Curse of Re-encryption: A Generic Power/EM Analysis on Post-Quantum KEMs",
    "authors": "Rei Ueno; Keita Xagawa; Yutaro Tanaka; Akira Ito; Junko Takahashi; Naofumi Homma",
    "year": 2021,
    "venue": "IACR Cryptology ePrint Archive",
    "doi": "",
    "url": "https://eprint.iacr.org/2021/849",
    "tags": [
      "PQC/KEM",
      "Side-channel analysis/Power and EM",
      "Machine learning/Deep learning"
    ],
    "metadataSource": "IACR ePrint",
    "type": "posted-content"
  }
];

// Every account gets independent paper/tag objects. Seeding never calls external services.
export function createStarterLibrary(now=Date.now()){
 const papers=examples.map((paper,index)=>({abstract:'',notes:'',...structuredClone(paper),sample:true,status:'unread',importance:3,added:now-index*1000,updated:now-index*1000}));
 return {papers,settings:{}};
}
