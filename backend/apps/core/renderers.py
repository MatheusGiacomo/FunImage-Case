"""
apps/core/renderers.py
Uniform response envelope for all successful API responses.

    {
        "success": true,
        "data": { ... },       # or [ ... ] for lists
        "meta": {              # present on paginated responses
            "total": 120,
            "page": 1,
            "per_page": 30,
            "total_pages": 4
        }
    }
"""

from rest_framework.renderers import JSONRenderer


class SuccessRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if renderer_context is None:
            return super().render(data, accepted_media_type, renderer_context)

        response = renderer_context.get("response")

        # Error responses are already wrapped by the exception handler
        if response is not None and response.status_code >= 400:
            return super().render(data, accepted_media_type, renderer_context)

        # Paginated response — has count/results structure
        if isinstance(data, dict) and "results" in data and "count" in data:
            # Extract pagination meta from DRF pagination output
            wrapped = {
                "success": True,
                "data": data["results"],
                "meta": {
                    "total": data.get("count", 0),
                    "page": data.get("page", 1),
                    "per_page": data.get("per_page", 30),
                    "total_pages": data.get("total_pages", 1),
                    "next": data.get("next"),
                    "previous": data.get("previous"),
                },
            }
        elif data is None:
            wrapped = {"success": True, "data": None}
        else:
            wrapped = {"success": True, "data": data}

        return super().render(wrapped, accepted_media_type, renderer_context)
