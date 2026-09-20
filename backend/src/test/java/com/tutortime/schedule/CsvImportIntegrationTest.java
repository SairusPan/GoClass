package com.tutortime.schedule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CsvImportIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void templateDownloadDoesNotNeedABody() throws Exception {
        String token = register("csvtemplate");
        mockMvc.perform(get("/api/import/subjects/template").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("name")))
                .andExpect(content().string(containsString("Maths Methods")));
    }

    @Test
    void importingSubjectsThenTeachersThenClassesLeavesClassesUnscheduled() throws Exception {
        String token = register("csvhappy");

        importCsv(token, "subjects", "subjects.csv", "name\nFurther Maths\nLiterature\n");
        importCsv(token, "rooms", "rooms.csv", "name,capacity\nStudio 1,10\n");
        importCsv(token, "teachers", "teachers.csv",
                "name,phone,email,subjects,availability\n"
                        + "Alex Nguyen,0400111222,alex@example.com,Further Maths|Literature,Mon 16:00-18:00;Tue 17:00-19:00\n");
        importCsv(token, "classes", "classes.csv",
                "name,subject,studentCount,durationMinutes\nFurther Maths U3/4,Further Maths,7,\n");

        JsonNode subjects = list("/api/subjects", token);
        assertThat(subjects.findValuesAsText("name")).contains("Further Maths", "Literature");

        JsonNode teachers = list("/api/teachers", token);
        assertThat(teachers.get(0).get("name").asText()).isEqualTo("Alex Nguyen");
        assertThat(teachers.get(0).get("subjectIds").size()).isEqualTo(2);

        JsonNode classes = list("/api/classes", token);
        assertThat(classes.get(0).get("name").asText()).isEqualTo("Further Maths U3/4");
        assertThat(classes.get(0).get("status").asText()).isEqualTo("unscheduled");
        assertThat(classes.get(0).get("day").isNull()).isTrue();
        assertThat(classes.get(0).get("teacherId").isNull()).isTrue();
        assertThat(classes.get(0).get("durationMinutes").asInt()).isEqualTo(60);
    }

    @Test
    void aBadRowRollsTheWholeFileBack() throws Exception {
        String token = register("csvrollback");

        mockMvc.perform(multipart("/api/import/subjects")
                        .file(csv("subjects.csv", "name\nGood Subject\nGood Subject\n"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("already exists")));

        assertThat(list("/api/subjects", token).size()).isZero();
    }

    @Test
    void aWrongHeaderOrExcelFileIsRefused() throws Exception {
        String token = register("csvheader");

        mockMvc.perform(multipart("/api/import/subjects")
                        .file(csv("subjects.csv", "title\nMaths\n"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Unexpected columns")));

        mockMvc.perform(multipart("/api/import/subjects")
                        .file(new MockMultipartFile("file", "subjects.xlsx",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                "name\nMaths\n".getBytes()))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("CSV")));
    }

    @Test
    void aTeacherCannotNameASubjectThatIsNotInThisInstitution() throws Exception {
        String token = register("csvnosubject");
        mockMvc.perform(multipart("/api/import/teachers")
                        .file(csv("teachers.csv",
                                "name,phone,email,subjects,availability\n"
                                        + "Alex Nguyen,,alex@example.com,Does Not Exist,Mon 16:00-18:00\n"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("import subjects first")));
        assertThat(list("/api/teachers", token).size()).isZero();
    }

    @Test
    void aDuplicateNameInTheSameInstitutionIsRefused() throws Exception {
        String token = register("csvdupe");
        importCsv(token, "subjects", "subjects.csv", "name\nChemistry\n");
        mockMvc.perform(multipart("/api/import/subjects")
                        .file(csv("subjects.csv", "name\nchemistry\n"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("already exists")));
        assertThat(list("/api/subjects", token).size()).isEqualTo(1);
    }

    @Test
    void importIsRejectedWithoutAToken() throws Exception {
        mockMvc.perform(multipart("/api/import/subjects").file(csv("subjects.csv", "name\nMaths\n")))
                .andExpect(status().isUnauthorized());
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s Tutoring","adminName":"Admin","username":"%s","email":"%s@example.com","password":"secret123","seedDemoData":false}
                                """.formatted(username, username, username)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private void importCsv(String token, String type, String filename, String body) throws Exception {
        mockMvc.perform(multipart("/api/import/" + type)
                        .file(csv(filename, body))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(type));
    }

    private JsonNode list(String path, String token) throws Exception {
        MvcResult result = mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static MockMultipartFile csv(String filename, String body) {
        return new MockMultipartFile("file", filename, "text/csv", body.getBytes());
    }
}
