"""
Streamura ML Clustering Training Pipeline

Machine learning pipeline for training and deploying clustering models
used in the Intelligent Discovery system. Replaces heuristic-based
clustering with ML-powered event grouping.

Features:
- Stream feature extraction
- Multiple clustering algorithms (K-Means, DBSCAN, HDBSCAN)
- Model evaluation and selection
- Incremental training support
- Model versioning and deployment
"""

import os
import json
import pickle
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)

# Try to import ML libraries, provide fallback
try:
    import numpy as np
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import silhouette_score, calinski_harabasz_score
    
    try:
        import hdbscan
        HDBSCAN_AVAILABLE = True
    except ImportError:
        HDBSCAN_AVAILABLE = False
    
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    HDBSCAN_AVAILABLE = False


class ClusteringAlgorithm(str, Enum):
    """Supported clustering algorithms."""
    KMEANS = "kmeans"
    DBSCAN = "dbscan"
    HDBSCAN = "hdbscan"


class ModelStatus(str, Enum):
    """Status of a trained model."""
    TRAINING = "training"
    EVALUATING = "evaluating"
    READY = "ready"
    DEPLOYED = "deployed"
    ARCHIVED = "archived"
    FAILED = "failed"


@dataclass
class StreamFeatures:
    """Extracted features for a stream."""
    stream_id: int
    latitude: float
    longitude: float
    start_time: float  # Unix timestamp
    category_embedding: List[float]
    viewer_count: int
    creator_trust_score: float
    content_tags: List[str]
    
    def to_vector(self) -> List[float]:
        """Convert to feature vector for clustering."""
        return [
            self.latitude,
            self.longitude,
            self.start_time,
            *self.category_embedding[:10],  # First 10 embedding dims
            self.viewer_count / 1000,  # Normalize
            self.creator_trust_score,
        ]


@dataclass
class ModelMetadata:
    """Metadata for a trained model."""
    model_id: str
    algorithm: ClusteringAlgorithm
    version: str
    created_at: datetime
    training_samples: int
    hyperparameters: Dict[str, Any]
    metrics: Dict[str, float]
    status: ModelStatus
    feature_scaler_path: Optional[str] = None
    model_path: Optional[str] = None
    

@dataclass
class TrainingConfig:
    """Configuration for training pipeline."""
    algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS
    hyperparameters: Dict[str, Any] = field(default_factory=dict)
    min_samples: int = 100
    max_clusters: int = 50
    validation_split: float = 0.2
    output_dir: str = "./models/clustering"


@dataclass
class ClusteringResult:
    """Result of clustering operation."""
    cluster_labels: List[int]
    n_clusters: int
    silhouette_score: float
    calinski_harabasz_score: float
    cluster_centers: Optional[List[List[float]]] = None
    cluster_sizes: Dict[int, int] = field(default_factory=dict)


class FeatureExtractor:
    """
    Extracts features from raw stream data for clustering.
    """
    
    def __init__(self, category_embeddings: Optional[Dict[str, List[float]]] = None):
        self.category_embeddings = category_embeddings or {}
        self.default_embedding = [0.0] * 10
    
    def extract(self, stream_data: Dict[str, Any]) -> StreamFeatures:
        """Extract features from stream data."""
        # Get category embedding
        category = stream_data.get("category", "other")
        category_embedding = self.category_embeddings.get(
            category, self.default_embedding
        )
        
        # Extract location (default to 0,0 if not provided)
        lat = stream_data.get("latitude", 0.0) or 0.0
        lon = stream_data.get("longitude", 0.0) or 0.0
        
        # Parse timestamp
        start_time = stream_data.get("started_at")
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            start_time = start_time.timestamp()
        elif start_time is None:
            start_time = datetime.now().timestamp()
        
        return StreamFeatures(
            stream_id=stream_data.get("id", 0),
            latitude=lat,
            longitude=lon,
            start_time=start_time,
            category_embedding=category_embedding,
            viewer_count=stream_data.get("viewer_count", 0),
            creator_trust_score=stream_data.get("trust_score", 0.5),
            content_tags=stream_data.get("tags", []),
        )
    
    def batch_extract(self, streams: List[Dict[str, Any]]) -> List[StreamFeatures]:
        """Extract features from multiple streams."""
        return [self.extract(s) for s in streams]


class ClusteringTrainer:
    """
    Trains clustering models for stream discovery.
    """
    
    def __init__(self, config: Optional[TrainingConfig] = None):
        self.config = config or TrainingConfig()
        self.scaler = None
        self.model = None
        self.metadata: Optional[ModelMetadata] = None
        
        if not ML_AVAILABLE:
            logger.warning("ML libraries not available. Training disabled.")
    
    def _prepare_data(
        self,
        features: List[StreamFeatures]
    ) -> Tuple[Any, Any]:
        """Prepare and scale feature data."""
        if not ML_AVAILABLE:
            raise RuntimeError("ML libraries required for training")
        
        # Convert to numpy array
        X = np.array([f.to_vector() for f in features])
        
        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        return X, X_scaled
    
    def _create_model(self) -> Any:
        """Create clustering model based on config."""
        algorithm = self.config.algorithm
        params = self.config.hyperparameters
        
        if algorithm == ClusteringAlgorithm.KMEANS:
            return KMeans(
                n_clusters=params.get("n_clusters", 10),
                random_state=params.get("random_state", 42),
                n_init=params.get("n_init", 10),
            )
        
        elif algorithm == ClusteringAlgorithm.DBSCAN:
            return DBSCAN(
                eps=params.get("eps", 0.5),
                min_samples=params.get("min_samples", 5),
            )
        
        elif algorithm == ClusteringAlgorithm.HDBSCAN:
            if not HDBSCAN_AVAILABLE:
                raise RuntimeError("HDBSCAN not installed")
            return hdbscan.HDBSCAN(
                min_cluster_size=params.get("min_cluster_size", 5),
                min_samples=params.get("min_samples", 3),
            )
        
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")
    
    def train(
        self,
        features: List[StreamFeatures],
        validate: bool = True
    ) -> ClusteringResult:
        """Train clustering model."""
        if not ML_AVAILABLE:
            raise RuntimeError("ML libraries required for training")
        
        if len(features) < self.config.min_samples:
            raise ValueError(
                f"Insufficient training data: {len(features)} < {self.config.min_samples}"
            )
        
        logger.info(f"Training {self.config.algorithm.value} model with {len(features)} samples")
        
        # Prepare data
        X_raw, X_scaled = self._prepare_data(features)
        
        # Create and train model
        self.model = self._create_model()
        labels = self.model.fit_predict(X_scaled)
        
        # Calculate metrics
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        
        metrics = {}
        if n_clusters > 1:
            metrics["silhouette"] = silhouette_score(X_scaled, labels)
            metrics["calinski_harabasz"] = calinski_harabasz_score(X_scaled, labels)
        else:
            metrics["silhouette"] = 0.0
            metrics["calinski_harabasz"] = 0.0
        
        # Get cluster sizes
        cluster_sizes = {}
        for label in labels:
            cluster_sizes[int(label)] = cluster_sizes.get(int(label), 0) + 1
        
        # Get cluster centers if available
        centers = None
        if hasattr(self.model, "cluster_centers_"):
            centers = self.model.cluster_centers_.tolist()
        
        # Create metadata
        model_id = hashlib.sha256(
            f"{self.config.algorithm.value}_{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:12]
        
        self.metadata = ModelMetadata(
            model_id=model_id,
            algorithm=self.config.algorithm,
            version="1.0.0",
            created_at=datetime.utcnow(),
            training_samples=len(features),
            hyperparameters=self.config.hyperparameters,
            metrics=metrics,
            status=ModelStatus.READY,
        )
        
        logger.info(
            f"Training complete: {n_clusters} clusters, "
            f"silhouette={metrics['silhouette']:.3f}"
        )
        
        return ClusteringResult(
            cluster_labels=labels.tolist(),
            n_clusters=n_clusters,
            silhouette_score=metrics["silhouette"],
            calinski_harabasz_score=metrics["calinski_harabasz"],
            cluster_centers=centers,
            cluster_sizes=cluster_sizes,
        )
    
    def save(self, output_dir: Optional[str] = None) -> Dict[str, str]:
        """Save trained model and scaler."""
        if self.model is None or self.scaler is None:
            raise RuntimeError("No model to save. Train first.")
        
        output_dir = output_dir or self.config.output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        model_id = self.metadata.model_id
        
        # Save model
        model_path = os.path.join(output_dir, f"model_{model_id}.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)
        
        # Save scaler
        scaler_path = os.path.join(output_dir, f"scaler_{model_id}.pkl")
        with open(scaler_path, "wb") as f:
            pickle.dump(self.scaler, f)
        
        # Save metadata
        self.metadata.model_path = model_path
        self.metadata.feature_scaler_path = scaler_path
        
        metadata_path = os.path.join(output_dir, f"metadata_{model_id}.json")
        with open(metadata_path, "w") as f:
            json.dump({
                "model_id": self.metadata.model_id,
                "algorithm": self.metadata.algorithm.value,
                "version": self.metadata.version,
                "created_at": self.metadata.created_at.isoformat(),
                "training_samples": self.metadata.training_samples,
                "hyperparameters": self.metadata.hyperparameters,
                "metrics": self.metadata.metrics,
                "status": self.metadata.status.value,
                "model_path": model_path,
                "scaler_path": scaler_path,
            }, f, indent=2)
        
        logger.info(f"Model saved to {output_dir}")
        
        return {
            "model_path": model_path,
            "scaler_path": scaler_path,
            "metadata_path": metadata_path,
        }
    
    @classmethod
    def load(cls, model_dir: str, model_id: str) -> 'ClusteringTrainer':
        """Load a trained model."""
        if not ML_AVAILABLE:
            raise RuntimeError("ML libraries required")
        
        # Load metadata
        metadata_path = os.path.join(model_dir, f"metadata_{model_id}.json")
        with open(metadata_path, "r") as f:
            meta = json.load(f)
        
        # Load model
        with open(meta["model_path"], "rb") as f:
            model = pickle.load(f)
        
        # Load scaler
        with open(meta["scaler_path"], "rb") as f:
            scaler = pickle.load(f)
        
        # Create trainer instance
        trainer = cls(TrainingConfig(
            algorithm=ClusteringAlgorithm(meta["algorithm"]),
            hyperparameters=meta["hyperparameters"],
        ))
        trainer.model = model
        trainer.scaler = scaler
        trainer.metadata = ModelMetadata(
            model_id=meta["model_id"],
            algorithm=ClusteringAlgorithm(meta["algorithm"]),
            version=meta["version"],
            created_at=datetime.fromisoformat(meta["created_at"]),
            training_samples=meta["training_samples"],
            hyperparameters=meta["hyperparameters"],
            metrics=meta["metrics"],
            status=ModelStatus(meta["status"]),
            model_path=meta["model_path"],
            feature_scaler_path=meta["scaler_path"],
        )
        
        return trainer
    
    def predict(self, features: List[StreamFeatures]) -> List[int]:
        """Predict cluster assignments for new streams."""
        if self.model is None or self.scaler is None:
            raise RuntimeError("No model loaded. Train or load first.")
        
        X = np.array([f.to_vector() for f in features])
        X_scaled = self.scaler.transform(X)
        
        if hasattr(self.model, "predict"):
            return self.model.predict(X_scaled).tolist()
        else:
            # For DBSCAN-like models, use fit_predict on new data
            return self.model.fit_predict(X_scaled).tolist()


class ClusteringPipeline:
    """
    End-to-end pipeline for clustering model training and deployment.
    """
    
    def __init__(
        self,
        model_dir: str = "./models/clustering",
        feature_extractor: Optional[FeatureExtractor] = None
    ):
        self.model_dir = model_dir
        self.feature_extractor = feature_extractor or FeatureExtractor()
        self.current_model: Optional[ClusteringTrainer] = None
        
        os.makedirs(model_dir, exist_ok=True)
    
    def train_new_model(
        self,
        streams: List[Dict[str, Any]],
        algorithm: ClusteringAlgorithm = ClusteringAlgorithm.KMEANS,
        hyperparameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Train a new clustering model."""
        # Extract features
        features = self.feature_extractor.batch_extract(streams)
        
        # Configure training
        config = TrainingConfig(
            algorithm=algorithm,
            hyperparameters=hyperparameters or {},
            output_dir=self.model_dir,
        )
        
        # Train model
        trainer = ClusteringTrainer(config)
        result = trainer.train(features)
        
        # Save model
        paths = trainer.save()
        
        return {
            "model_id": trainer.metadata.model_id,
            "algorithm": algorithm.value,
            "n_clusters": result.n_clusters,
            "silhouette_score": result.silhouette_score,
            "training_samples": len(features),
            "paths": paths,
        }
    
    def deploy_model(self, model_id: str) -> bool:
        """Deploy a trained model for inference."""
        try:
            self.current_model = ClusteringTrainer.load(self.model_dir, model_id)
            self.current_model.metadata.status = ModelStatus.DEPLOYED
            logger.info(f"Deployed model {model_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to deploy model {model_id}: {e}")
            return False
    
    def predict_clusters(
        self,
        streams: List[Dict[str, Any]]
    ) -> List[int]:
        """Predict cluster assignments for streams."""
        if self.current_model is None:
            raise RuntimeError("No model deployed. Call deploy_model first.")
        
        features = self.feature_extractor.batch_extract(streams)
        return self.current_model.predict(features)
    
    def get_model_info(self) -> Optional[Dict[str, Any]]:
        """Get information about the deployed model."""
        if self.current_model is None or self.current_model.metadata is None:
            return None
        
        meta = self.current_model.metadata
        return {
            "model_id": meta.model_id,
            "algorithm": meta.algorithm.value,
            "version": meta.version,
            "created_at": meta.created_at.isoformat(),
            "training_samples": meta.training_samples,
            "metrics": meta.metrics,
            "status": meta.status.value,
        }
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List all available models."""
        models = []
        
        for filename in os.listdir(self.model_dir):
            if filename.startswith("metadata_") and filename.endswith(".json"):
                with open(os.path.join(self.model_dir, filename)) as f:
                    meta = json.load(f)
                    models.append({
                        "model_id": meta["model_id"],
                        "algorithm": meta["algorithm"],
                        "status": meta["status"],
                        "created_at": meta["created_at"],
                        "metrics": meta["metrics"],
                    })
        
        return sorted(models, key=lambda x: x["created_at"], reverse=True)


# Global pipeline instance
clustering_pipeline = ClusteringPipeline()
