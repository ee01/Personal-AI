export const GET_INIT_TOPICS_QUERY = (username: string) => {
    return `
    Please extract the topics and key takeaways from all the data, as well as ${username}'s follow-ups.

    -OutputFormat-
    * ### Topic: topic 1
        * #### Summary: summary for this topic
        * #### Key takeaways
        * key takeaway 1 
        * key takeaway 2
        * #### My followUps
        * [priority]: my followup 1 [type:id]
        * [priority]: my followup 2 [type:id]
    
    =======Roles=======
    1. <My followUps> stand for ${username}'s follow-ups.
    2. <summary> use topic description.
    `;
}