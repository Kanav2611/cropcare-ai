'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { loadModel, predictImage } from '@/lib/modelLoader';
import type * as tmImage from '@teachablemachine/image';

interface Prediction {
  className: string;
  probability: number;
}

interface HistoryItem {
  id: string;
  imageSrc: string;
  timestamp: string;
  topDisease: string;
  confidence: number;
  predictions: Prediction[];
}

interface RemedyInfo {
  title: string;
  description: string;
  remedies: string[];
  prevention: string[];
}

const remedyDatabase: Record<string, RemedyInfo> = {
  Early_blight: {
    title: 'Early Blight (Alternaria solani)',
    description:
      'A fungal disease commonly associated with dark brown spots and concentric rings, often first noticed on older, lower leaves.',
    remedies: [
      'Remove badly affected leaves where practical and dispose of them away from the crop.',
      'Improve airflow by maintaining suitable plant spacing and avoiding prolonged leaf wetness.',
      'If disease pressure is significant, consult a local agricultural extension officer about locally registered control options.',
    ],
    prevention: [
      'Rotate tomatoes with non-solanaceous crops where practical.',
      'Use healthy seed or seedlings and locally recommended resistant varieties.',
      'Prefer drip or soil-level watering and avoid working among wet plants.',
    ],
  },
  Late_blight: {
    title: 'Late Blight (Phytophthora infestans)',
    description:
      'A destructive disease that can cause rapidly expanding, water-soaked or dark lesions on leaves, stems and fruit, especially in cool, humid conditions.',
    remedies: [
      'Seek prompt confirmation from an agricultural expert because late blight can spread quickly.',
      'Remove and safely dispose of severely affected plant material according to local guidance.',
      'Ask a local extension officer about registered management options for your crop and area.',
    ],
    prevention: [
      'Monitor crops closely during cool, wet or humid weather.',
      'Avoid prolonged leaf wetness and improve airflow through the crop.',
      'Remove volunteer tomato and potato plants and manage crop residues appropriately.',
    ],
  },
  Bacterial_spot: {
    title: 'Bacterial Spot (Xanthomonas spp.)',
    description:
      'A bacterial disease that may produce small, dark, water-soaked lesions on leaves and fruit. Visual symptoms can overlap with other problems.',
    remedies: [
      'Confirm the diagnosis before choosing a treatment because bacterial and fungal diseases need different management.',
      'Remove heavily affected material where appropriate and follow local crop sanitation guidance.',
      'Ask an agricultural extension officer about locally approved management options.',
    ],
    prevention: [
      'Use healthy, disease-free seeds or seedlings.',
      'Clean tools and avoid handling plants when foliage is wet.',
      'Manage crop residues and avoid moving contaminated plant material between plots.',
    ],
  },
  healthy: {
    title: 'Healthy Plant',
    description:
      'The image appears most similar to the healthy class learned by this model. Continue routine crop monitoring; this is not a guarantee that the plant is disease-free.',
    remedies: [
      'No disease-specific treatment is indicated by this image prediction.',
      'Continue regular field scouting and seek expert advice if symptoms appear.',
    ],
    prevention: [
      'Maintain balanced crop nutrition and suitable soil moisture.',
      'Keep the field clean and monitor for early symptoms or pest activity.',
      'Inspect plants regularly, including the lower leaves and stems.',
    ],
  },
};

const prettyClassName = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const getRemedyInfo = (className: string): RemedyInfo => {
  const normalized = className.toLowerCase().replace(/[\s-]+/g, '_');
  return remedyDatabase[normalized] ?? {
    title: prettyClassName(className),
    description:
      'The model has returned this class label. Use the prediction as a preliminary screening result and seek expert confirmation before taking action.',
    remedies: [
      'Do not apply a treatment based only on this automated prediction.',
      'Compare the symptoms with trusted local agricultural guidance or consult an extension officer.',
    ],
    prevention: [
      'Continue regular crop monitoring.',
      'Capture clear photographs of both affected and healthy plant parts for expert review.',
    ],
  };
};

export default function Home() {
  const [model, setModel] = useState<tmImage.CustomMobileNet | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const loadedModel = await loadModel();
        if (active) {
          setModel(loadedModel);
          setModelError(null);
        }
      } catch (error) {
        console.error('Failed to load model:', error);
        if (active) setModelError('The model could not be loaded. Check your model files and refresh the page.');
      } finally {
        if (active) setLoadingModel(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a valid image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Please choose an image smaller than 10 MB.');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setImageSrc(nextUrl);
    setPredictions(null);
    setUploadError(null);
  };

  const handlePredict = async () => {
    if (!model || !imageRef.current || !imageSrc) return;

    setIsAnalyzing(true);
    setUploadError(null);

    try {
      const result = await predictImage(model, imageRef.current);
      setPredictions(result);

      const sorted = [...result].sort((a, b) => b.probability - a.probability);
      const top = sorted[0];

      if (top) {
        setHistory((previous) => [
          {
            id: Date.now().toString(),
            imageSrc,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            topDisease: top.className,
            confidence: top.probability,
            predictions: result,
          },
          ...previous,
        ]);
      }
    } catch (error) {
      console.error('Prediction failed:', error);
      setUploadError('The image could not be analyzed. Please try another clear leaf photograph.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setImageSrc(item.imageSrc);
    setPredictions(item.predictions);
    setUploadError(null);
  };

  const topPrediction = predictions
    ? [...predictions].sort((a, b) => b.probability - a.probability)[0]
    : null;

  const currentRemedyInfo = topPrediction ? getRemedyInfo(topPrediction.className) : null;
  const confidencePercent = topPrediction ? topPrediction.probability * 100 : 0;
  const isLowConfidence = confidencePercent < 65;

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-[#18352b] selection:bg-emerald-200 selection:text-emerald-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#e5e9df] bg-[#fbfcf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b7653] text-2xl text-white shadow-sm shadow-emerald-900/15">
              🌱
            </div>
            <div>
              <p className="text-[17px] font-extrabold tracking-tight text-[#17382c]">CropCare AI</p>
              <p className="text-[11px] font-medium tracking-wide text-[#78877d]">
                SMART AGRICULTURAL DIAGNOSTICS <span className="px-1 text-[#b5c0b6]">/</span> CSE276 P09
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[#dcece1] bg-white px-3.5 py-2 text-xs font-semibold text-[#16734e]">
            <span className={`h-2 w-2 rounded-full ${loadingModel ? 'animate-pulse bg-amber-400' : modelError ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            {loadingModel ? 'Connecting model' : modelError ? 'Model unavailable' : 'AI model ready'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 md:px-10 md:pt-10">
        {/* Intro */}
        <section className="mb-9 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#23835d]">
              Crop health intelligence
            </p>
            <h1 className="text-3xl font-black leading-tight tracking-[-0.04em] text-[#17382c] md:text-[42px]">
              A clearer picture of
              <span className="text-[#16845a]"> plant health.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#68786e] md:text-[15px]">
              Upload a tomato leaf image to screen for selected diseases and explore a preliminary AI assessment.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#718077]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f3e9] text-lg">🍃</span>
            <span><strong className="block text-[#355b48]">Tomato leaf screening</strong>Healthy · Early blight · Late blight · Bacterial spot</span>
          </div>
        </section>

        {modelError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {modelError}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.55fr)]">
          {/* Left: image input and history */}
          <aside className="space-y-8">
            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_45px_rgba(35,66,48,0.06)]">
              <div className="px-6 pb-4 pt-6 md:px-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#829087]">01 / Specimen</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#1b3c2f]">Leaf image</h2>
                  </div>
                  <span className="text-2xl">📷</span>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#78867d]">
                  Choose a clear, well-lit photograph with the leaf visible in full.
                </p>
              </div>

              <div className="px-6 pb-6 md:px-7">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />

                <div
                  className={`group relative flex min-h-[270px] cursor-pointer items-center justify-center overflow-hidden rounded-[22px] bg-[#f3f7f1] transition hover:bg-[#edf5ed] ${imageSrc ? '' : 'border border-dashed border-[#cbd9cd]'
                    }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Choose a leaf image"
                >
                  {imageSrc ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={imageRef}
                        src={imageSrc}
                        alt="Uploaded crop leaf"
                        className="max-h-[340px] w-full object-contain"
                      />
                      <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#26714f] shadow-sm">
                        Image ready · Change photo
                      </span>
                    </>
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-3xl shadow-sm transition group-hover:-translate-y-1">
                        🪴
                      </div>
                      <p className="mt-4 text-sm font-bold text-[#355b48]">Choose a leaf photograph</p>
                      <p className="mt-1 text-xs text-[#8a978e]">JPG, PNG or WEBP · Up to 10 MB</p>
                      <span className="mt-5 inline-flex rounded-full bg-[#176f4d] px-5 py-2.5 text-xs font-bold text-white transition group-hover:bg-[#105c3e]">
                        Browse images
                      </span>
                    </div>
                  )}
                </div>

                {uploadError && <p className="mt-3 text-xs font-medium text-rose-600">{uploadError}</p>}

                {imageSrc && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={handlePredict}
                      disabled={!model || loadingModel || isAnalyzing}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#087b55] px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(8,123,85,0.18)] transition hover:-translate-y-0.5 hover:bg-[#066746] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Analyzing image…
                        </>
                      ) : (
                        <>✦ Run diagnosis</>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setImageSrc(null);
                        setPredictions(null);
                        setUploadError(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="rounded-full border border-[#dce6dc] px-5 py-3.5 text-sm font-semibold text-[#587064] transition hover:bg-[#f4f8f2]"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <p className="mt-4 text-[11px] leading-5 text-[#9aa59d]">
                  Best results: one leaf, sharp focus, natural light and minimal background clutter.
                </p>
              </div>
            </section>

            {/* History */}
            <section className="px-1">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#829087]">Recent activity</p>
                  <h3 className="mt-1 text-lg font-extrabold tracking-tight text-[#1b3c2f]">Scan history</h3>
                </div>
                <span className="text-xs font-semibold text-[#8b998f]">{history.length} scans</span>
              </div>

              {history.length === 0 ? (
                <div className="border-l-2 border-[#dce9dc] py-2 pl-4 text-sm leading-6 text-[#8a978e]">
                  Your recent scans will appear here after the first diagnosis.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageSrc} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[#355b48]">{prettyClassName(item.topDisease)}</span>
                        <span className="mt-0.5 block text-[11px] text-[#9aa59d]">{item.timestamp}</span>
                      </span>
                      <span className="text-xs font-bold text-[#16845a]">{(item.confidence * 100).toFixed(0)}%</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>

          {/* Right: diagnosis */}
          <section className="min-w-0">
            {!predictions || !topPrediction || !currentRemedyInfo ? (
              <div className="flex min-h-[470px] flex-col justify-between overflow-hidden rounded-[30px] bg-[#eaf2e8] p-7 md:p-10">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#478064]">02 / AI assessment</p>
                  <h2 className="mt-3 max-w-lg text-3xl font-black leading-tight tracking-[-0.04em] text-[#1a4934] md:text-4xl">
                    Your crop health report starts here.
                  </h2>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-[#668071]">
                    Once you run a scan, the model’s leading class, confidence score and supporting class scores will appear in this space.
                  </p>
                </div>
                <div className="mt-10 flex items-end justify-between">
                  <div className="space-y-2 text-xs text-[#6e8979]">
                    <p>✓ Image-based screening</p>
                    <p>✓ Class confidence breakdown</p>
                    <p>✓ General prevention guidance</p>
                  </div>
                  <div className="select-none text-7xl opacity-80 md:text-8xl">🌿</div>
                </div>
              </div>
            ) : (
              <div className="space-y-9">
                {/* Main result — editorial, not a stack of cards */}
                <section className="relative overflow-hidden rounded-[30px] bg-[#103f2e] p-7 text-white md:p-9">
                  <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[34px] border-white/[0.05]" />
                  <div className="pointer-events-none absolute -bottom-28 right-24 h-64 w-64 rounded-full bg-[#2a8057]/25 blur-2xl" />

                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9d6b9]">Primary diagnosis result</p>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#d7f0df]">
                        {isLowConfidence ? 'Needs review' : 'Model prediction'}
                      </span>
                    </div>

                    <div className="mt-7 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                      <div className="max-w-xl">
                        <h2 className="text-3xl font-black leading-tight tracking-[-0.035em] md:text-[38px]">
                          {currentRemedyInfo.title}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#c5dfcf]">
                          {currentRemedyInfo.description}
                        </p>
                      </div>
                      <div className="shrink-0 md:text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9d6b9]">Top class score</p>
                        <p className="mt-1 text-5xl font-black tracking-tight text-white">{confidencePercent.toFixed(1)}<span className="text-2xl">%</span></p>
                      </div>
                    </div>

                    {isLowConfidence && (
                      <div className="mt-6 rounded-2xl border border-amber-200/25 bg-amber-100/10 px-4 py-3 text-xs leading-5 text-amber-100">
                        This result has a relatively low model score. Try a clearer image and seek expert confirmation before taking action.
                      </div>
                    )}
                  </div>
                </section>

                {/* Confidence scores */}
                <section className="px-1">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#829087]">Model output</p>
                      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-[#1b3c2f]">Class score breakdown</h3>
                    </div>
                    <span className="text-[11px] text-[#9aa59d]">Scores are not guarantees</span>
                  </div>

                  <div className="space-y-4">
                    {[...predictions].sort((a, b) => b.probability - a.probability).map((prediction) => {
                      const isTop = prediction.className === topPrediction.className;
                      const score = Math.max(0, Math.min(100, prediction.probability * 100));
                      return (
                        <div key={prediction.className}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className={`text-sm ${isTop ? 'font-extrabold text-[#245b40]' : 'font-medium text-[#718077]'}`}>
                              {prettyClassName(prediction.className)}
                            </span>
                            <span className={`text-sm tabular-nums ${isTop ? 'font-extrabold text-[#16845a]' : 'font-semibold text-[#718077]'}`}>
                              {score.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#e5ebe3]">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${isTop ? 'bg-[#15915f]' : 'bg-[#a9c4ad]'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Guidance */}
                <section className="grid gap-8 border-t border-[#e1e8df] pt-7 md:grid-cols-2">
                  <div>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1dc] text-lg">🧭</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a27b3f]">Next steps</p>
                        <h3 className="text-lg font-extrabold text-[#294a38]">Management guidance</h3>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {currentRemedyInfo.remedies.map((remedy, index) => (
                        <li key={index} className="flex gap-3 text-sm leading-6 text-[#68786e]">
                          <span className="mt-0.5 font-bold text-[#c18b3d]">0{index + 1}</span>
                          <span>{remedy}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:border-l md:border-[#e1e8df] md:pl-7">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f2e7] text-lg">🛡️</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4e8968]">Reduce future risk</p>
                        <h3 className="text-lg font-extrabold text-[#294a38]">Preventive care</h3>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {currentRemedyInfo.prevention.map((item, index) => (
                        <li key={index} className="flex gap-3 text-sm leading-6 text-[#68786e]">
                          <span className="mt-0.5 font-bold text-[#4b9b70]">0{index + 1}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <p className="border-l-2 border-[#d9b36c] py-1 pl-4 text-[11px] leading-5 text-[#8a8876]">
                  Important: CropCare AI provides preliminary image-based screening, not a confirmed diagnosis. Visual symptoms can overlap. Confirm with a qualified agricultural expert before applying pesticides or other treatments, and always follow local registration and product-label instructions.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-[#e5e9df] bg-[#fbfcf8]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 text-center text-[11px] text-[#8a978e] md:flex-row md:items-center md:justify-between md:px-10 md:text-left">
          <span className="font-semibold text-[#557261]">CropCare AI · Intelligent crop-health support</span>
          <span>Built with Next.js, TensorFlow.js and Teachable Machine · CSE276 P09</span>
        </div>
      </footer>
    </div>
  );
}
