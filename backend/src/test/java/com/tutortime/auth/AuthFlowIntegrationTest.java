package com.tutortime.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the whole register -> login -> protected route -> refresh -> logout story
 * against an in-memory H2 database (see application-test.yml) so it never touches a
 * real MySQL instance.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InstitutionRepository institutionRepository;

    @Test
    void registerThenAccessProtectedRoute() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Harbour View Tutoring","adminName":"Alex Tan","username":"harbourview","email":"harbourview@example.com","password":"secret123"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.institution.username").value("harbourview"))
                .andReturn();

        String accessToken = readField(result, "accessToken");

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Harbour View Tutoring"))
                .andExpect(jsonPath("$.adminName").value("Alex Tan"));
    }

    @Test
    void duplicateUsernameIsRejected() throws Exception {
        String body = """
                {"name":"Centre A","adminName":"Admin A","username":"dupe","email":"dupe@example.com","password":"secret123"}
                """;
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("That username is already registered."));
    }

    @Test
    void loginWithWrongPasswordIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre B","adminName":"Admin B","username":"centreb","email":"centreb@example.com","password":"correctpass"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"centreb","password":"wrongpass"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Incorrect username or password."));
    }

    @Test
    void protectedRouteWithoutTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesTokensAndInvalidatesTheOldRefreshToken() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre C","adminName":"Admin C","username":"centrec","email":"centrec@example.com","password":"secret123"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String originalRefreshToken = readField(registerResult, "refreshToken");

        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshBody(originalRefreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();

        String newAccessToken = readField(refreshResult, "accessToken");
        String newRefreshToken = readField(refreshResult, "refreshToken");
        assertThat(newRefreshToken).isNotEqualTo(originalRefreshToken);

        // new access token works against the protected route
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newAccessToken))
                .andExpect(status().isOk());

        // replaying the ORIGINAL (now-rotated-out) refresh token must fail
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshBody(originalRefreshToken))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void accessTokenCannotBeUsedToRefresh() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre D","adminName":"Admin D","username":"centred","email":"centred@example.com","password":"secret123"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String accessToken = readField(result, "accessToken");

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshBody(accessToken))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesTheRefreshToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre E","adminName":"Admin E","username":"centree","email":"centree@example.com","password":"secret123"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String accessToken = readField(result, "accessToken");
        String refreshToken = readField(result, "refreshToken");

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshBody(refreshToken))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void forgotPasswordIsSilentForAnUnknownUsername() throws Exception {
        // Must not reveal whether the username exists — same 200 either way.
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nobody-registered-with-this-name\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void forgotPasswordThenResetPasswordAllowsLoginWithTheNewPasswordOnly() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre F","adminName":"Admin F","username":"centref","email":"centref@example.com","password":"originalpass"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"centref\"}"))
                .andExpect(status().isOk());

        // The token only ever goes out by email — pull it straight from the row to drive the reset.
        String token = institutionRepository.findByUsername("centref").orElseThrow().getResetToken();
        assertThat(token).isNotBlank();

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"newPassword\":\"brandnewpass\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"centref\",\"password\":\"originalpass\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"centref\",\"password\":\"brandnewpass\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void resetPasswordWithAnInvalidTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"not-a-real-token\",\"newPassword\":\"whatever123\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resettingThePasswordInvalidatesTheExistingRefreshToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Centre G","adminName":"Admin G","username":"centreg","email":"centreg@example.com","password":"originalpass"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        String refreshToken = readField(result, "refreshToken");

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"centreg\"}"))
                .andExpect(status().isOk());
        String token = institutionRepository.findByUsername("centreg").orElseThrow().getResetToken();

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"newPassword\":\"brandnewpass\"}"))
                .andExpect(status().isOk());

        // the session that existed before the reset must no longer work
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RefreshBody(refreshToken))))
                .andExpect(status().isUnauthorized());
    }

    private String readField(MvcResult result, String field) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get(field).asText();
    }

    private record RefreshBody(String refreshToken) {
    }
}
