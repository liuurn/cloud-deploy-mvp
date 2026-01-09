package com.jd.joygen.unisandbox_demo;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "`user`")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;

    private String gender;

    private String name;

    private Integer age;

    private LocalDateTime updateTime;

    private Integer status;

    @PrePersist
    @PreUpdate
    public void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }
}