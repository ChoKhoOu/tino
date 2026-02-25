"""AnalyticsService — statistical anomaly detection via gRPC.

Inherits from the proto-generated AnalyticsServiceServicer base class and implements:
  - DetectAnomalies: run statistical anomaly detection on provided data
"""

from __future__ import annotations

import logging

import grpc
import numpy as np

from tino_daemon.analytics.anomaly import (
    AnomalyType,
    DetectionConfig,
    run_detection,
)
from tino_daemon.proto.tino.analytics.v1 import analytics_pb2, analytics_pb2_grpc

logger = logging.getLogger(__name__)

# Map proto enum to internal enum
_PROTO_TO_TYPE = {
    analytics_pb2.ANOMALY_TYPE_PRICE: AnomalyType.PRICE,
    analytics_pb2.ANOMALY_TYPE_VOLUME: AnomalyType.VOLUME,
    analytics_pb2.ANOMALY_TYPE_FUNDING_RATE: AnomalyType.FUNDING_RATE,
    analytics_pb2.ANOMALY_TYPE_OPEN_INTEREST: AnomalyType.OPEN_INTEREST,
    analytics_pb2.ANOMALY_TYPE_LIQUIDATION_CASCADE: AnomalyType.LIQUIDATION_CASCADE,
}

# Map internal enum to proto enum
_TYPE_TO_PROTO = {
    AnomalyType.PRICE: analytics_pb2.ANOMALY_TYPE_PRICE,
    AnomalyType.VOLUME: analytics_pb2.ANOMALY_TYPE_VOLUME,
    AnomalyType.FUNDING_RATE: analytics_pb2.ANOMALY_TYPE_FUNDING_RATE,
    AnomalyType.OPEN_INTEREST: analytics_pb2.ANOMALY_TYPE_OPEN_INTEREST,
    AnomalyType.LIQUIDATION_CASCADE: analytics_pb2.ANOMALY_TYPE_LIQUIDATION_CASCADE,
}


def _data_points_to_arrays(
    points: list,
) -> tuple[np.ndarray, np.ndarray] | None:
    """Convert repeated DataPoint proto messages to numpy arrays."""
    if not points:
        return None
    timestamps = np.array([p.timestamp for p in points], dtype=np.float64)
    values = np.array([p.value for p in points], dtype=np.float64)
    return timestamps, values


class AnalyticsServiceServicer(analytics_pb2_grpc.AnalyticsServiceServicer):
    """gRPC AnalyticsService implementation using proto-generated servicer base."""

    async def DetectAnomalies(
        self,
        request: analytics_pb2.DetectAnomaliesRequest,
        context: grpc.aio.ServicerContext,
    ) -> analytics_pb2.DetectAnomaliesResponse:
        """Run anomaly detection on the provided data points."""
        logger.info(
            "DetectAnomalies: types=%s, data_sizes=prices:%d volumes:%d funding:%d oi:%d liq:%d",
            [t for t in request.types],
            len(request.prices),
            len(request.volumes),
            len(request.funding_rates),
            len(request.open_interests),
            len(request.liquidations),
        )

        try:
            # Parse requested types
            types: list[AnomalyType] | None = None
            if request.types:
                types = []
                for t in request.types:
                    if t in _PROTO_TO_TYPE:
                        types.append(_PROTO_TO_TYPE[t])

            # Build config with defaults
            config = DetectionConfig(
                zscore_threshold=request.zscore_threshold or 3.0,
                window_size=request.window_size or 20,
                percentile_threshold=request.percentile_threshold or 95.0,
            )

            # Convert proto data points to numpy arrays
            prices = _data_points_to_arrays(request.prices)
            volumes = _data_points_to_arrays(request.volumes)
            funding_rates = _data_points_to_arrays(request.funding_rates)
            open_interests = _data_points_to_arrays(request.open_interests)
            liquidations = _data_points_to_arrays(request.liquidations)

            # Run detection
            report = run_detection(
                types=types,
                prices=prices,
                volumes=volumes,
                funding_rates=funding_rates,
                open_interests=open_interests,
                liquidations=liquidations,
                config=config,
            )

            # Convert results to proto
            proto_anomalies = []
            for a in report.anomalies:
                proto_anomalies.append(
                    analytics_pb2.Anomaly(
                        type=_TYPE_TO_PROTO[a.anomaly_type],
                        severity=a.severity.value,
                        score=a.score,
                        threshold=a.threshold,
                        timestamp=a.timestamp,
                        value=a.value,
                        description=a.description,
                    )
                )

            return analytics_pb2.DetectAnomaliesResponse(
                anomalies=proto_anomalies,
                total_points_analyzed=report.total_points_analyzed,
                summary=report.summary,
            )

        except Exception as exc:
            logger.exception("DetectAnomalies unexpected error")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Internal error: {exc}")
            return analytics_pb2.DetectAnomaliesResponse(
                summary=f"Error: {exc}",
            )
