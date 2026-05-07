import React, { useEffect, useRef, useState } from "react";
import logoMark from "../../../assets/branding/flanel-karawang-mark.png";
import "./LogoLoadingScreen.css";

const DEFAULT_MESSAGE = "Memuat session IMS Bunga Flanel...";

const isYellowPixel = (red, green, blue, alpha) => {
  if (alpha < 8) return false;

  return red >= 145 && green >= 105 && blue <= 130 && red > blue * 1.45;
};

const drawSplitLayer = ({ canvas, image, sourceData, keepPixel }) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  const { naturalWidth: width, naturalHeight: height } = image;

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);

  const layerData = new ImageData(
    new Uint8ClampedArray(sourceData.data),
    width,
    height,
  );

  for (let index = 0; index < layerData.data.length; index += 4) {
    const red = layerData.data[index];
    const green = layerData.data[index + 1];
    const blue = layerData.data[index + 2];
    const alpha = layerData.data[index + 3];

    if (!keepPixel(red, green, blue, alpha)) {
      layerData.data[index + 3] = 0;
    }
  }

  context.putImageData(layerData, 0, 0);
};

// =====================================================
// SECTION: Global Logo Loading Screen — AKTIF / GUARDED
// Fungsi:
// - Menampilkan loading global/auth/route memakai logo mark Flanel Karawang dengan animasi micro split yang UI-only.
//
// Dipakai oleh:
// - App.jsx untuk auth/session gate.
// - ProtectedRoute.jsx untuk route guard loading.
// - Login.jsx untuk auth/profile loading.
// - AppRoutes.jsx untuk lazy route fallback.
//
// Alasan perubahan:
// - Menyatukan loading utama aplikasi ke LogoLoadingScreen full viewport tanpa card/wrap kecil, tanpa mengubah auth guard, route guard, login flow, atau route definition.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - Jika fallback dihapus atau canvas gagal, loading bisa terlihat blank; karena itu logo normal tetap disediakan sebagai fallback.
// =====================================================
const LogoLoadingScreen = ({ message = DEFAULT_MESSAGE }) => {
  const yellowCanvasRef = useRef(null);
  const blueCanvasRef = useRef(null);
  const [isSplitReady, setIsSplitReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const image = new Image();

    image.decoding = "async";

    image.onload = () => {
      const yellowCanvas = yellowCanvasRef.current;
      const blueCanvas = blueCanvasRef.current;

      if (!yellowCanvas || !blueCanvas || !isMounted) {
        return;
      }

      try {
        const { naturalWidth: width, naturalHeight: height } = image;
        const sourceCanvas = document.createElement("canvas");
        const sourceContext = sourceCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!width || !height || !sourceContext) {
          throw new Error("Logo source unavailable");
        }

        sourceCanvas.width = width;
        sourceCanvas.height = height;
        sourceContext.drawImage(image, 0, 0, width, height);

        const sourceData = sourceContext.getImageData(0, 0, width, height);

        drawSplitLayer({
          canvas: yellowCanvas,
          image,
          sourceData,
          keepPixel: isYellowPixel,
        });

        drawSplitLayer({
          canvas: blueCanvas,
          image,
          sourceData,
          keepPixel: (red, green, blue, alpha) =>
            alpha >= 8 && !isYellowPixel(red, green, blue, alpha),
        });

        if (isMounted) {
          setIsSplitReady(true);
        }
      } catch {
        if (isMounted) {
          setIsSplitReady(false);
        }
      }
    };

    image.onerror = () => {
      if (isMounted) {
        setIsSplitReady(false);
      }
    };

    image.src = logoMark;

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      className="app-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading-card">
        <div
          className={`ims-logo-loader${isSplitReady ? " is-split-ready" : ""}`}
          aria-hidden="true"
        >
          <span className="ims-logo-loader-glow" />
          <img
            className="ims-logo-loader-fallback"
            src={logoMark}
            alt=""
            draggable="false"
          />
          <canvas
            className="ims-logo-loader-layer ims-logo-loader-yellow"
            ref={yellowCanvasRef}
          />
          <canvas
            className="ims-logo-loader-layer ims-logo-loader-blue"
            ref={blueCanvasRef}
          />
        </div>

        <p className="app-loading-text">{message}</p>
      </div>
    </div>
  );
};

export default LogoLoadingScreen;
