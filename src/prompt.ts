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


export const SALES_QUERY = (username: string) => {
    return  `
    I am ${username}, I work in sales. Please generate a report template based on my industry, including all my chat data. The template should focus on the three most important aspects: 
    1. Customer situation 
    2. Progress of key projects 
    3. Main challenges and opportunities.

    All usernames should use the markdown link format: [Customer Name](https://app.ringcentral.com/).
    Output according to output format without any introductory text or additional comments.

    -OutputFormat-
    ### 1. Customer Situation
    - Key Customers:
        - Customer 1: [Customer Name](https://app.ringcentral.com/)
            - Purchased Products: [Product Name]
            - Feedback: [Customer Feedback]
        - Customer 2: [Customer Name](https://app.ringcentral.com/)
            - Purchased Products: [Product Name]
            - Feedback: [Customer Feedback]
    ### 2. Key Project Progress
    - Project 1 Name:
        - Progress: [Progress details]
        - Results: [Achievement details]
    - Project 2 Name:
        - Progress: [Progress details]
        - Results: [Achievement details]
    ### 3. Main Challenges and Opportunities
    - Challenges:
        - Challenge 1: [Description]
        - Challenge 2: [Description]
    - Opportunities:
        - Opportunity 1: [Description]
        - Opportunity 2: [Description]
    `
}