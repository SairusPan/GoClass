package com.tutortime.common;

import com.tutortime.auth.JwtAuthFilter;
import jakarta.servlet.http.HttpServletRequest;

public final class CurrentInstitution {

    private CurrentInstitution() {
    }

    public static Long id(HttpServletRequest request) {
        return (Long) request.getAttribute(JwtAuthFilter.INSTITUTION_ID_ATTR);
    }
}
