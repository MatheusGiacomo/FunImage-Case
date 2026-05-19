"""
apps/core/pagination.py
Pagination classes with meta envelope support.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "per_page"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            {
                "results": data,
                "count": self.page.paginator.count,
                "page": self.page.number,
                "per_page": self.get_page_size(self.request),
                "total_pages": self.page.paginator.num_pages,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "required": ["count", "results"],
            "properties": {
                "count": {"type": "integer", "example": 120},
                "page": {"type": "integer", "example": 1},
                "per_page": {"type": "integer", "example": 30},
                "total_pages": {"type": "integer", "example": 4},
                "next": {"type": "string", "nullable": True, "format": "uri"},
                "previous": {"type": "string", "nullable": True, "format": "uri"},
                "results": schema,
            },
        }
