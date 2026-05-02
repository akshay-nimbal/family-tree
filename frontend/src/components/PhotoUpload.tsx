import { useState, useRef } from "react";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface PhotoUploadProps {
  personId: string;
  currentPhotoUrl?: string;
  onPhotoUploaded: (photoUrl: string) => void;
}

export function PhotoUpload({ personId, currentPhotoUrl, onPhotoUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photoSrc = currentPhotoUrl ? `${API_BASE}${currentPhotoUrl}` : null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, and WebP files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadPhoto(personId, file);
      onPhotoUploaded(result.photoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="photo-upload">
      <button
        type="button"
        className="photo-preview"
        onClick={() => fileRef.current?.click()}
      >
        {photoSrc ? (
          <img src={photoSrc} alt="Profile" className="photo-img" />
        ) : (
          <div className="photo-placeholder">
            <span className="photo-placeholder-icon">+</span>
            <span className="photo-placeholder-text">Add Photo</span>
          </div>
        )}
        {uploading && <div className="photo-uploading">Uploading...</div>}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="photo-input-hidden"
      />
      {photoSrc && !uploading && (
        <button
          type="button"
          className="photo-change-btn"
          onClick={() => fileRef.current?.click()}
        >
          Change Photo
        </button>
      )}
      {error && <p className="photo-error">{error}</p>}
    </div>
  );
}

export function PhotoAvatar({ photoUrl, name, size = 40 }: { photoUrl?: string; name: string; size?: number }) {
  const src = photoUrl ? `${API_BASE}${photoUrl}` : null;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="photo-avatar" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="photo-avatar-img" style={{ width: size, height: size }} />
      ) : (
        <span className="photo-avatar-initials" style={{ fontSize: size * 0.35 }}>{initials}</span>
      )}
    </div>
  );
}
