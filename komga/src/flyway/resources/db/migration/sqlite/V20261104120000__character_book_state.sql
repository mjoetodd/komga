create table CHARACTER_BOOK_STATE
(
    BOOK_ID                varchar not null
        constraint CHARACTER_BOOK_STATE_PK
            primary key,
    REPROCESS_CHARACTERS   boolean not null default false,
    REPROCESS_AUDIOBOOK    boolean not null default false
);

create table CHARACTER_DISMISSED_SUGGESTION
(
    SERIES_ID varchar not null,
    PAIR_KEY  varchar not null,
    constraint CHARACTER_DISMISSED_SUGGESTION_PK
        primary key (SERIES_ID, PAIR_KEY)
);
