package com.tutortime;

import com.tutortime.auth.JwtProperties;
import com.tutortime.email.EmailProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({JwtProperties.class, EmailProperties.class})
public class TutorTimeApplication {

    public static void main(String[] args) {
        SpringApplication.run(TutorTimeApplication.class, args);
    }
}
