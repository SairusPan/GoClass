package com.tutortime.schedule;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The whole point of moving scheduling data onto the backend was per-tenant isolation, so most
 * of these tests are about proving institution A can never read or write institution B's data —
 * not just that the CRUD plumbing works.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ScheduleFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerAndGetAccessToken(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s Tutoring","adminName":"Admin %s","username":"%s","email":"%s@example.com","password":"secret123"}
                                """.formatted(username, username, username, username)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    @Test
    void registeringSeedsSixTeachersSixSubjectsFourRoomsAndTenClasses() throws Exception {
        String token = registerAndGetAccessToken("seedcheck");

        mockMvc.perform(get("/api/teachers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
        mockMvc.perform(get("/api/subjects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
        mockMvc.perform(get("/api/rooms").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
        mockMvc.perform(get("/api/classes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(10));
    }

    @Test
    void seededDataIncludesTheDeliberateThursdayConflict() throws Exception {
        String token = registerAndGetAccessToken("conflictcheck");

        MvcResult result = mockMvc.perform(get("/api/classes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode classes = objectMapper.readTree(result.getResponse().getContentAsString());

        long thursdaySeventeenCount = 0;
        for (JsonNode c : classes) {
            if ("Thu".equals(c.get("day").asText(null)) && "17:00".equals(c.get("start").asText(null))) {
                thursdaySeventeenCount++;
            }
        }
        assertThat(thursdaySeventeenCount).isEqualTo(2); // Specialist Maths U3/4 + Physics U3/4, same teacher+room
    }

    @Test
    void twoInstitutionsNeverSeeEachOthersTeachers() throws Exception {
        String tokenA = registerAndGetAccessToken("tenanta");
        String tokenB = registerAndGetAccessToken("tenantb");

        JsonNode teachersA = listAsJson("/api/teachers", tokenA);
        JsonNode teachersB = listAsJson("/api/teachers", tokenB);

        assertThat(teachersA.size()).isEqualTo(6);
        assertThat(teachersB.size()).isEqualTo(6);

        var idsA = new java.util.HashSet<Long>();
        teachersA.forEach(t -> idsA.add(t.get("id").asLong()));
        var idsB = new java.util.HashSet<Long>();
        teachersB.forEach(t -> idsB.add(t.get("id").asLong()));

        // Two independently-seeded tenants must not share a single teacher row.
        idsA.retainAll(idsB);
        assertThat(idsA).isEmpty();
    }

    @Test
    void institutionCannotPatchAnotherInstitutionsClass() throws Exception {
        String tokenA = registerAndGetAccessToken("victim");
        String tokenB = registerAndGetAccessToken("attacker");

        JsonNode classesA = listAsJson("/api/classes", tokenA);
        long someClassIdBelongingToA = classesA.get(0).get("id").asLong();

        // B tries to PATCH a class it doesn't own, by guessing/reusing A's id.
        mockMvc.perform(patch("/api/classes/" + someClassIdBelongingToA)
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"published\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void creatingAClassAddsItToTheListAsUnscheduled() throws Exception {
        String token = registerAndGetAccessToken("createclass");
        JsonNode subjects = listAsJson("/api/subjects", token);
        long subjectId = subjects.get(0).get("id").asLong();

        mockMvc.perform(post("/api/classes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Brand New Class\",\"subjectId\":" + subjectId + ",\"studentCount\":5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Brand New Class"))
                .andExpect(jsonPath("$.status").value("unscheduled"))
                .andExpect(jsonPath("$.subjectId").value(subjectId))
                .andExpect(jsonPath("$.teacherId").doesNotExist());

        JsonNode classes = listAsJson("/api/classes", token);
        assertThat(classes.size()).isEqualTo(11); // 10 seeded + this one
        assertThat(findFirst(classes, c -> "Brand New Class".equals(c.get("name").asText()))).isNotNull();
    }

    @Test
    void creatingAClassInOneInstitutionIsInvisibleToAnother() throws Exception {
        String tokenA = registerAndGetAccessToken("createiso1");
        String tokenB = registerAndGetAccessToken("createiso2");
        JsonNode subjectsA = listAsJson("/api/subjects", tokenA);
        long subjectId = subjectsA.get(0).get("id").asLong();

        mockMvc.perform(post("/api/classes")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Only In A\",\"subjectId\":" + subjectId + ",\"studentCount\":5}"))
                .andExpect(status().isCreated());

        JsonNode classesB = listAsJson("/api/classes", tokenB);
        assertThat(classesB.size()).isEqualTo(10); // unaffected by A's new class
    }

    @Test
    void assigningAnUnscheduledClassMovesItToDraft() throws Exception {
        String token = registerAndGetAccessToken("assigncheck");

        JsonNode classes = listAsJson("/api/classes", token);
        JsonNode teachers = listAsJson("/api/teachers", token);
        JsonNode rooms = listAsJson("/api/rooms", token);

        JsonNode unscheduled = findFirst(classes, c -> "unscheduled".equals(c.get("status").asText()));
        long classId = unscheduled.get("id").asLong();
        long teacherId = teachers.get(0).get("id").asLong();
        long roomId = rooms.get(0).get("id").asLong();

        mockMvc.perform(patch("/api/classes/" + classId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"teacherId":%d,"roomId":%d,"day":"Mon","start":"09:00"}
                                """.formatted(teacherId, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.day").value("Mon"))
                .andExpect(jsonPath("$.start").value("09:00"));
    }

    @Test
    void publishingAScheduledClassQueuesATeacherNotificationButDraftAssignmentDoesNot() throws Exception {
        String token = registerAndGetAccessToken("publishnotify");

        JsonNode classes = listAsJson("/api/classes", token);
        JsonNode teachers = listAsJson("/api/teachers", token);
        JsonNode rooms = listAsJson("/api/rooms", token);
        JsonNode unscheduled = findFirst(classes, c -> "unscheduled".equals(c.get("status").asText()));
        long classId = unscheduled.get("id").asLong();
        long teacherId = teachers.get(0).get("id").asLong();
        long roomId = rooms.get(0).get("id").asLong();

        // Draft assignment alone must not notify — an admin may reassign several times while drafting.
        mockMvc.perform(patch("/api/classes/" + classId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teacherId\":%d,\"roomId\":%d,\"day\":\"Mon\",\"start\":\"09:00\"}".formatted(teacherId, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"));

        assertThat(listAsJson("/api/notifications", token).size()).isEqualTo(0);

        // Publishing is the confirmed, final step — that's what should notify the teacher.
        mockMvc.perform(post("/api/classes/" + classId + "/publish").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("published"));

        JsonNode notifications = listAsJson("/api/notifications", token);
        assertThat(notifications.size()).isEqualTo(1);
        assertThat(notifications.get(0).get("audience").asText()).isEqualTo("teacher");
    }

    @Test
    void fileLeaveAndResolveWithSubstituteUpdatesTheClassAndQueuesNotifications() throws Exception {
        String token = registerAndGetAccessToken("leavecheck");

        JsonNode classes = listAsJson("/api/classes", token);
        // Monday 16:00 Maths Methods U3/4, taught by Sarah Chen — Emily Zhao is free at that time too.
        JsonNode mondayClass = findFirst(classes, c -> "Mon".equals(c.get("day").asText(null)) && "16:00".equals(c.get("start").asText(null)));
        long classId = mondayClass.get("id").asLong();

        JsonNode teachers = listAsJson("/api/teachers", token);
        JsonNode emily = findFirst(teachers, t -> "Emily Zhao".equals(t.get("name").asText()));
        long emilyId = emily.get("id").asLong();

        MvcResult fileResult = mockMvc.perform(post("/api/leave")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"classId\":" + classId + ",\"reason\":\"Sick leave\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.resolution").value("pending"))
                .andReturn();
        long leaveId = objectMapper.readTree(fileResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/leave/" + leaveId + "/substitute")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teacherId\":" + emilyId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolution").value("substitute"))
                .andExpect(jsonPath("$.resolvedTeacherId").value(emilyId));

        // the class itself must now show Emily as the teacher
        JsonNode updatedClasses = listAsJson("/api/classes", token);
        JsonNode updatedClass = findFirst(updatedClasses, c -> c.get("id").asLong() == classId);
        assertThat(updatedClass.get("teacherId").asLong()).isEqualTo(emilyId);

        // file() queues 1 ("finding cover"), resolveWithSubstitute() queues 2 more (teacher + parent) = 3
        JsonNode notifications = listAsJson("/api/notifications", token);
        assertThat(notifications.size()).isEqualTo(3);
    }

    @Test
    void scheduleEndpointsRejectRequestsWithNoToken() throws Exception {
        mockMvc.perform(get("/api/teachers")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/classes")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/leave")).andExpect(status().isUnauthorized());
    }

    private JsonNode listAsJson(String path, String token) throws Exception {
        MvcResult result = mockMvc.perform(get(path).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode findFirst(JsonNode array, java.util.function.Predicate<JsonNode> predicate) {
        for (JsonNode node : array) {
            if (predicate.test(node)) return node;
        }
        throw new AssertionError("No matching element found in: " + array);
    }
}
